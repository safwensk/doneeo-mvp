package com.doneeo.api;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.port=0",
        "spring.datasource.url=jdbc:h2:mem:customer-flow;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
})
class CustomerFlowTest {
    @Value("${local.server.port}") int port;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate database;
    static final AtomicInteger calls = new AtomicInteger();
    static final ObjectMapper fixtureJson = JsonMapper.builder().build();
    static HttpServer plannerStub;
    static JsonNode lastCommand;

    @DynamicPropertySource
    static void plannerAddress(DynamicPropertyRegistry properties) throws Exception {
        plannerStub = HttpServer.create(new java.net.InetSocketAddress("localhost", 0), 0);
        plannerStub.createContext("/api/plan", exchange -> {
            calls.incrementAndGet();
            lastCommand = fixtureJson.readTree(exchange.getRequestBody());
            boolean answered = lastCommand.path("answers").has("customer_help");
            ObjectNode result = fixtureJson.createObjectNode()
                    .put("workCaseId", lastCommand.path("workCaseId").asText("WC-" + lastCommand.path("correlationId").asText()))
                    .put("jobOrderId", "JOB-test")
                    .put("state", "INTELLIGENCE_IN_PROGRESS").put("currentLayerId", "L02")
                    .put("correlationId", lastCommand.path("correlationId").asText())
                    .put("stateVersion", answered ? 3 : 2)
                    .put("requirementReady", answered).put("mode", "safe-fallback+rules");
            ObjectNode analysis = result.putObject("analysis");
            analysis.put("title", "Move and assemble").put("summary", "Two tasks preserved.");
            analysis.put("sourceText", lastCommand.path("request").asText("Move a sofa and assemble a desk."));
            analysis.putObject("extractedAnswers");
            result.set("answers", lastCommand.path("answers"));
            analysis.putArray("tasks").add("Move the sofa").add("Assemble the desk");
            analysis.putObject("intelligence").put("version", "original-engine");
            analysis.putArray("questions").addObject().put("id", "customer_help")
                    .put("label", "Can you help with the lifting?")
                    .put("type", "boolean").put("required", true);
            byte[] data = fixtureJson.writeValueAsBytes(result);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, data.length);
            try (var stream = exchange.getResponseBody()) { stream.write(data); }
        });
        plannerStub.createContext("/api/route", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] data = "{\"error\":\"Route provider credentials need configuration\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(401, data.length);
            try (var stream = exchange.getResponseBody()) { stream.write(data); }
        });
        plannerStub.start();
        properties.add("doneeo.planner.url", () -> "http://localhost:" + plannerStub.getAddress().getPort());
    }

    @AfterAll
    static void stopPlanner() {
        if (plannerStub != null) plannerStub.stop(0);
    }

    @Test
    void loginOwnershipAnswerContinuityAndRetry() throws Exception {
        Client owner = new Client();
        assertEquals(401, owner.request("GET", "/api/chat/latest", null, false).statusCode());
        owner.refreshCsrf();
        String email = UUID.randomUUID() + "@example.test";
        Map<String, String> credentials = Map.of("name", "Test customer", "email", email,
                "password", "A-test-only-password-2026");
        assertEquals(403, owner.request("POST", "/api/auth/register", credentials, false).statusCode());
        var registration = owner.request("POST", "/api/auth/register", credentials, true);
        assertEquals(200, registration.statusCode(), registration.body());
        assertNotEquals(credentials.get("password"), database.queryForObject(
                "SELECT password_hash FROM customer_accounts WHERE email=?", String.class, email));
        owner.refreshCsrf();

        String conversation = UUID.randomUUID().toString();
        String operation = UUID.randomUUID().toString();
        Map<String, Object> first = Map.of("conversationId", conversation, "operationId", operation,
                "message", "Move a sofa and assemble a desk.");
        int beforeInitial = calls.get();
        var firstResponse = owner.request("POST", "/api/chat", first, true);
        assertEquals(200, firstResponse.statusCode(), firstResponse.body());
        String workCaseId = json.readTree(firstResponse.body()).path("control").path("workCaseId").asText();
        var replay = owner.request("POST", "/api/chat", first, true);
        assertEquals(firstResponse.body(), replay.body());
        assertEquals(beforeInitial + 1, calls.get(), "A retry must not re-run the planner.");

        Client other = new Client();
        other.refreshCsrf();
        assertEquals(200, other.request("POST", "/api/auth/register",
                Map.of("name", "Other customer", "email", UUID.randomUUID() + "@example.test",
                        "password", "Another-test-password-2026"), true).statusCode());
        other.refreshCsrf();
        JsonNode otherLatest = json.readTree(other.request("GET", "/api/chat/latest", null, false).body());
        assertTrue(otherLatest.path("conversation").isNull());
        var forbidden = other.request("POST", "/api/chat", Map.of(
                "conversationId", conversation, "operationId", UUID.randomUUID().toString(),
                "message", "Try to read another customer's request"), true);
        assertEquals(404, forbidden.statusCode());

        var answer = owner.request("POST", "/api/chat", Map.of(
                "conversationId", conversation, "operationId", UUID.randomUUID().toString(),
                "message", "No", "questionId", "customer_help", "answer", false), true);
        assertEquals(200, answer.statusCode(), answer.body());
        JsonNode updated = json.readTree(answer.body());
        assertEquals("PLAN_READY", updated.path("stage").asText());
        assertEquals(workCaseId, updated.path("control").path("workCaseId").asText());
        assertEquals(4, updated.path("history").size());
        assertEquals(workCaseId, lastCommand.path("workCaseId").asText());
        assertTrue(lastCommand.path("answers").path("customer_help").isBoolean());
        assertFalse(lastCommand.path("answers").path("customer_help").asBoolean());
        assertEquals(2, lastCommand.path("expectedStateVersion").asInt());
        assertEquals(204, owner.request("POST", "/api/auth/logout", Map.of(), true).statusCode());
        assertEquals(401, owner.request("GET", "/api/chat/latest", null, false).statusCode());
        owner.refreshCsrf();
        assertEquals(200, owner.request("POST", "/api/auth/login", credentials, true).statusCode());
        JsonNode restored = json.readTree(owner.request("GET", "/api/chat/latest", null, false).body());
        assertEquals(conversation, restored.path("conversation").path("conversationId").asText());
        assertEquals(4, restored.path("conversation").path("history").size());

        // The native GitHub workspace receives the complete engine payload,
        // including work saved by the previous chat UI.
        JsonNode workspace = json.readTree(owner.request("GET", "/api/workspace/latest", null, false).body());
        assertEquals(workCaseId, workspace.path("workCaseId").asText());
        assertEquals(2, workspace.path("analysis").path("tasks").size());
        assertEquals("original-engine", workspace.path("analysis").path("intelligence").path("version").asText());
        assertFalse(workspace.path("answers").path("customer_help").asBoolean());
        assertEquals("L02", workspace.path("currentLayerId").asText());
        assertTrue(json.readTree(other.request("GET", "/api/workspace/latest", null, false).body()).isEmpty());
        assertEquals(404, other.request("POST", "/api/plan", Map.of(
                "workCaseId", workCaseId, "resume", true, "operationId", "foreign-resume"), true).statusCode());
        assertEquals(403, owner.request("POST", "/api/plan", Map.of(
                "workCaseId", workCaseId, "operationId", "missing-csrf"), false).statusCode());
        var nativeAnswer = Map.of(
                "workCaseId", workCaseId, "expectedStateVersion", 3,
                "correlationId", conversation, "operationId", "answer-WC-test-v3-location",
                "answers", Map.of("customer_help", false, "service_address", "123 Example Street"));
        int before = calls.get();
        var nativeResponse = owner.request("POST", "/api/plan", nativeAnswer, true);
        assertEquals(200, nativeResponse.statusCode(), nativeResponse.body());
        assertEquals("123 Example Street", lastCommand.path("answers").path("service_address").asText());
        assertEquals(3, lastCommand.path("expectedStateVersion").asInt());
        assertEquals(nativeResponse.body(), owner.request("POST", "/api/plan", nativeAnswer, true).body());
        assertEquals(before + 1, calls.get());
        assertEquals(409, owner.request("POST", "/api/plan", Map.of(
                "workCaseId", workCaseId, "operationId", "answer-WC-test-v3-location",
                "answers", Map.of("service_address", "different")), true).statusCode());
        assertEquals(403, owner.request("POST", "/api/operations",
                Map.of("action", "reset_test_data"), true).statusCode());
        assertEquals(404, other.request("POST", "/api/operations", Map.of(
                "action", "create_work_order", "payload", Map.of(
                        "work_case_id", workCaseId, "public_reference", "DN-FOREIGN")), true).statusCode());
        assertEquals(502, owner.request("POST", "/api/route",
                Map.of("addresses", new String[]{"A", "B"}), true).statusCode());
        assertEquals(200, owner.request("GET", "/api/workspace/latest", null, false).statusCode(),
                "An upstream credential failure must not sign out the customer.");
    }

    @Test
    void discussionPersistsFromIntakeThroughClarificationWithoutDuplicateTurns() throws Exception {
        Client owner = new Client();
        owner.refreshCsrf();
        assertEquals(200, owner.request("POST", "/api/auth/register", Map.of(
                "name", "Conversation test", "email", UUID.randomUUID() + "@example.test",
                "password", "Local-discussion-test-2026!"), true).statusCode());
        owner.refreshCsrf();
        String correlation = UUID.randomUUID().toString();
        var intake = Map.of("request", "Move a sofa and assemble a desk.",
                "operationId", UUID.randomUUID().toString(), "correlationId", correlation);
        var first = owner.request("POST", "/api/plan", intake, true);
        assertEquals(200, first.statusCode(), first.body());
        JsonNode started = json.readTree(first.body());
        assertEquals(2, started.path("discussion").size());
        assertEquals("user", started.path("discussion").path(0).path("role").asText());
        assertEquals(intake.get("request"), started.path("discussion").path(0).path("text").asText());
        assertEquals("Two tasks preserved.", started.path("discussion").path(1).path("text").asText());
        assertFalse(started.path("requirementReady").asBoolean());
        assertEquals(first.body(), owner.request("POST", "/api/plan", intake, true).body());

        var reply = Map.of(
                "workCaseId", started.path("workCaseId").asText(), "expectedStateVersion", 2,
                "operationId", UUID.randomUUID().toString(), "correlationId", correlation,
                "answers", Map.of("customer_help", false), "discussionQuestionId", "customer_help");
        var answered = owner.request("POST", "/api/plan", reply, true);
        assertEquals(200, answered.statusCode(), answered.body());
        JsonNode completed = json.readTree(answered.body());
        assertEquals(4, completed.path("discussion").size());
        assertEquals("Can you help with the lifting?", completed.path("discussion").path(2).path("text").asText());
        assertEquals("No", completed.path("discussion").path(3).path("text").asText());
        assertTrue(completed.path("requirementReady").asBoolean());
        assertFalse(lastCommand.has("discussionQuestionId"), "Conversation metadata stays at the customer gateway.");
        assertEquals(answered.body(), owner.request("POST", "/api/plan", reply, true).body());
        JsonNode restored = json.readTree(owner.request("GET", "/api/workspace/latest", null, false).body());
        assertEquals(completed.path("discussion"), restored.path("discussion"));
        int beforeBadTurn = calls.get();
        assertEquals(400, owner.request("POST", "/api/plan", Map.of(
                "workCaseId", started.path("workCaseId").asText(), "expectedStateVersion", 3,
                "operationId", UUID.randomUUID().toString(), "discussionQuestionId", "unknown_question",
                "answers", Map.of("unknown_question", "anything")), true).statusCode());
        assertEquals(beforeBadTurn, calls.get());
    }

    @Test
    void executorProfilesStayPrivateAndValidateAvailabilityAndQualifications() throws Exception {
        String path = "/api/executor/profile";
        Client owner = new Client();
        assertEquals(401, owner.request("GET", path, null, false).statusCode());
        owner.refreshCsrf();
        var credentials = Map.of("name", "Preview worker", "email", UUID.randomUUID() + "@example.test",
                "password", "A-test-only-password-2026");
        var account = owner.request("POST", "/api/auth/register", credentials, true);
        assertEquals(200, account.statusCode(), account.body());
        String accountId = json.readTree(account.body()).path("id").asText();
        owner.refreshCsrf();
        assertEquals(204, owner.request("GET", path, null, false).statusCode());

        var profile = json.createObjectNode().put("role", "helper").put("serviceArea", " Toronto ")
                .put("skills", "Assembly and lifting").put("equipment", "Hand tools").put("timeZone", "America/Toronto");
        var monday = profile.putArray("availability").addObject().put("day", "MONDAY")
                .put("start", "09:00").put("end", "08:00");
        var update = Map.of("accountId", accountId, "profile", profile);
        assertEquals(403, owner.request("POST", path, update, false).statusCode());
        assertEquals(400, owner.request("POST", path, update, true).statusCode());
        monday.put("end", "17:00");
        var saved = owner.request("POST", path, update, true);
        assertEquals(200, saved.statusCode(), saved.body());
        assertEquals("Toronto", json.readTree(saved.body()).path("serviceArea").asText());

        Client other = new Client();
        other.refreshCsrf();
        assertEquals(200, other.request("POST", "/api/auth/register", Map.of("name", "Another worker",
                "email", UUID.randomUUID() + "@example.test", "password", "A-test-only-password-2026"), true).statusCode());
        other.refreshCsrf();
        assertEquals(204, other.request("GET", path, null, false).statusCode());
        assertEquals(409, other.request("POST", path, update, true).statusCode());

        assertEquals(204, owner.request("POST", "/api/auth/logout", Map.of(), true).statusCode());
        assertEquals(401, owner.request("GET", path, null, false).statusCode());
        owner.refreshCsrf();
        assertEquals(200, owner.request("POST", "/api/auth/login", credentials, true).statusCode());
        owner.refreshCsrf();
        assertEquals(json.readTree(saved.body()), json.readTree(owner.request("GET", path, null, false).body()));

        profile.put("role", "professional");
        profile.putArray("availability");
        assertEquals(400, owner.request("POST", path, update, true).statusCode());
        profile.putObject("qualifications").put("trade", "Electrician").put("region", "Ontario");
        var upgraded = owner.request("POST", path, update, true);
        assertEquals(200, upgraded.statusCode(), upgraded.body());
        var reloaded = json.readTree(owner.request("GET", path, null, false).body());
        assertEquals("professional", reloaded.path("role").asText());
        assertEquals("Electrician", reloaded.path("qualifications").path("trade").asText());
        assertEquals(0, reloaded.path("availability").size());
    }

    private class Client {
        private final HttpClient client = HttpClient.newBuilder()
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
        private String csrfToken;
        private String csrfHeader;

        void refreshCsrf() throws Exception {
            var session = json.readTree(request("GET", "/api/auth/session", null, false).body());
            csrfToken = session.path("csrfToken").asText();
            csrfHeader = session.path("csrfHeader").asText();
        }

        HttpResponse<String> request(String method, String path, Object body, boolean includeCsrf) throws Exception {
            var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
            if (includeCsrf) builder.header(csrfHeader, csrfToken);
            if (body == null) builder.GET();
            else builder.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
            return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        }
    }
}

