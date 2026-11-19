package com.doneeo.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Service
public class CustomerConversations {
    public record ChatInput(String conversationId, String operationId, String message,
                            String questionId, JsonNode answer) {}
    private record Conversation(String id, String request, String answers, String messages, String result) {}
    private final JdbcTemplate database;
    private final ObjectMapper json;
    private final PlannerGateway planner;

    public CustomerConversations(JdbcTemplate database, ObjectMapper json, PlannerGateway planner) {
        this.database = database;
        this.json = json;
        this.planner = planner;
    }

    public JsonNode latest(String accountId) {
        var rows = database.query(
                "SELECT * FROM customer_conversations WHERE account_id=? AND planner_result IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
                (row, index) -> new Conversation(row.getString("id"), row.getString("original_request"),
                        row.getString("answers_json"), row.getString("messages_json"),
                        row.getString("planner_result")), accountId);
        if (rows.isEmpty()) return json.createObjectNode().putNull("conversation");
        return json.createObjectNode().set("conversation", view(rows.getFirst()));
    }

    @Transactional(timeout = 180)
    public JsonNode reply(String accountId, ChatInput input) {
        requireUuid(input.conversationId());
        requireUuid(input.operationId());
        String message = input.message() == null ? "" : input.message().trim();
        if (message.isEmpty() || message.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Describe your request in up to 2000 characters.");
        }
        String hash = payloadHash(input);
        List<String> completed = database.query(
                "SELECT response_json FROM customer_chat_operations WHERE account_id=? AND operation_id=? AND payload_hash=?",
                (row, index) -> row.getString(1), accountId, input.operationId(), hash);
        if (!completed.isEmpty()) return json.readTree(completed.getFirst());

        // The row serializes answers. The engine separately checks the WorkCase
        // version and operation id when a previously interrupted request is retried.
        var rows = findForUpdate(accountId, input.conversationId());
        if (rows.isEmpty()) {
            if (input.questionId() != null || message.length() < 10) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start with a request of at least 10 characters.");
            }
            if (database.queryForObject("SELECT COUNT(*) FROM customer_conversations WHERE id=?",
                    Integer.class, input.conversationId()) != 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This conversation could not be found.");
            }
            database.update("INSERT INTO customer_conversations(id,account_id,original_request) VALUES (?,?,?)",
                    input.conversationId(), accountId, message);
            rows = findForUpdate(accountId, input.conversationId());
        }
        var previousOperations = database.query(
                "SELECT payload_hash,response_json FROM customer_chat_operations WHERE account_id=? AND operation_id=?",
                (row, index) -> List.of(row.getString(1), row.getString(2)), accountId, input.operationId());
        if (!previousOperations.isEmpty()) {
            var previous = previousOperations.getFirst();
            if (!previous.getFirst().equals(hash)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This request changed. Please submit it again.");
            }
            return json.readTree(previous.get(1));
        }

        Conversation current = rows.getFirst();
        ObjectNode answers = (ObjectNode) json.readTree(current.answers());
        ArrayNode messages = (ArrayNode) json.readTree(current.messages());
        ObjectNode command = json.createObjectNode()
                .put("operationId", input.operationId())
                .put("correlationId", input.conversationId());
        if (current.result() == null) {
            command.put("request", current.request());
        } else {
            JsonNode previous = json.readTree(current.result());
            JsonNode question = nextQuestion(previous, answers);
            if (question == null || !question.path("id").asText().equals(input.questionId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "The plan has moved on. Reopen your saved conversation to continue.");
            }
            JsonNode value = input.answer() == null ? json.getNodeFactory().textNode(message) : input.answer();
            if (question.path("type").asText().equals("boolean") && !value.isBoolean()) {
                if (message.equalsIgnoreCase("yes")) value = json.getNodeFactory().booleanNode(true);
                else if (message.equalsIgnoreCase("no")) value = json.getNodeFactory().booleanNode(false);
                else throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Yes or No for this question.");
            }
            if (!(value.isBoolean() || value.isTextual())
                    || (value.isTextual() && (value.asText().trim().length() < 2 || value.asText().length() > 300))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter an answer between 2 and 300 characters.");
            }
            if (question.path("type").asText().equals("choice")) {
                boolean allowed = false;
                for (JsonNode option : question.path("options")) {
                    if (option.equals(value)) allowed = true;
                }
                if (!allowed) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose one of the listed answers.");
            }
            answers.set(question.path("id").asText(), value);
            command.put("workCaseId", previous.path("workCaseId").asText())
                    .put("expectedStateVersion", previous.path("stateVersion").asInt());
        }
        command.set("answers", answers);
        JsonNode result = planner.plan(command);
        JsonNode question = nextQuestion(result, answers);
        String reply = responseMessage(result, question, current.result() == null);
        messages.addObject().put("side", "user").put("text", message);
        messages.addObject().put("side", "agent").put("text", reply);
        Conversation next = new Conversation(current.id(), current.request(),
                json.writeValueAsString(answers), json.writeValueAsString(messages), json.writeValueAsString(result));
        JsonNode response = view(next);
        database.update("UPDATE customer_conversations SET answers_json=?,messages_json=?,planner_result=?,updated_at=? WHERE id=? AND account_id=?",
                next.answers(), next.messages(), next.result(), java.time.Instant.now().toString(), next.id(), accountId);
        database.update("INSERT INTO customer_chat_operations(account_id,operation_id,conversation_id,payload_hash,response_json) VALUES (?,?,?,?,?)",
                accountId, input.operationId(), next.id(), hash, json.writeValueAsString(response));
        return response;
    }

    private List<Conversation> findForUpdate(String accountId, String id) {
        database.update("UPDATE customer_conversations SET id=id WHERE id=? AND account_id=?", id, accountId);
        return database.query("SELECT * FROM customer_conversations WHERE id=? AND account_id=?",
                (row, index) -> new Conversation(row.getString("id"), row.getString("original_request"),
                        row.getString("answers_json"), row.getString("messages_json"),
                        row.getString("planner_result")), id, accountId);
    }

    private JsonNode view(Conversation conversation) {
        JsonNode result = json.readTree(conversation.result());
        JsonNode question = nextQuestion(result, json.readTree(conversation.answers()));
        ObjectNode response = json.createObjectNode().put("conversationId", conversation.id())
                .put("stage", question != null ? "CLARIFYING"
                        : result.path("requirementReady").asBoolean() ? "PLAN_READY" : "REVIEW_REQUIRED")
                .put("mode", result.path("mode").asText());
        response.set("history", json.readTree(conversation.messages()));
        response.set("nextQuestion", question);
        response.set("analysis", result.path("analysis"));
        response.set("control", json.createObjectNode()
                .put("workCaseId", result.path("workCaseId").asText())
                .put("jobOrderId", result.path("jobOrderId").asText())
                .put("stateVersion", result.path("stateVersion").asInt())
                .put("requirementReady", result.path("requirementReady").asBoolean())
                .put("requirementContractRef", result.path("requirementContractRef").asText("")));
        return response;
    }

    private JsonNode nextQuestion(JsonNode result, JsonNode answers) {
        JsonNode analysis = result.path("analysis");
        for (JsonNode question : analysis.path("questions")) {
            if (question.has("required") && !question.path("required").asBoolean()) continue;
            String id = question.path("id").asText();
            if (hasAnswer(answers.path(id)) || hasAnswer(analysis.path("extractedAnswers").path(id))) continue;
            return question;
        }
        return null;
    }

    private boolean hasAnswer(JsonNode value) {
        return value.isBoolean() || (value.isTextual() && value.asText().trim().length() >= 2);
    }

    private String responseMessage(JsonNode result, JsonNode question, boolean first) {
        String opening = first ? "I can help you work through this. Let’s build the plan around your situation.\n\n" : "";
        if (question != null) {
            return opening + (first ? result.path("analysis").path("summary").asText() + "\n\n" : "")
                    + question.path("label").asText();
        }
        if (result.path("requirementReady").asBoolean()) {
            return opening + "Your requirements are ready. Review the tasks, resources and sequence below. Your work case and plan are saved to your account.";
        }
        return opening + "Your draft is saved. Doneeo still needs to resolve the flagged requirements before the plan can move forward.";
    }

    private void requireUuid(String value) {
        try {
            if (value == null || !UUID.fromString(value).toString().equals(value)) throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid conversation and operation identifier are required.");
        }
    }

    private String payloadHash(ChatInput input) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(json.writeValueAsString(input).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
