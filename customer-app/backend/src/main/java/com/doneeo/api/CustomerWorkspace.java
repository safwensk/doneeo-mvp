package com.doneeo.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
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
import tools.jackson.databind.node.ObjectNode;
import tools.jackson.databind.node.ArrayNode;

@Service
public class CustomerWorkspace {
    private final JdbcTemplate database;
    private final ObjectMapper json;
    private final PlannerGateway planner;

    public CustomerWorkspace(JdbcTemplate database, ObjectMapper json, PlannerGateway planner) {
        this.database = database;
        this.json = json;
        this.planner = planner;
    }

    @Transactional
    public JsonNode latest(String accountId) {
        var rows = database.query(
                "SELECT planner_result FROM customer_workspaces WHERE account_id=? ORDER BY updated_at DESC LIMIT 1",
                (row, index) -> row.getString(1), accountId);
        if (!rows.isEmpty()) {
            ObjectNode result = (ObjectNode) json.readTree(rows.getFirst());
            if (!result.path("discussion").isArray()) {
                result.set("discussion", discussionHistory(result));
                save(accountId, result);
            }
            return result;
        }
        // Carry forward work created through the earlier chat panel.
        var old = database.query(
                "SELECT planner_result,answers_json FROM customer_conversations WHERE account_id=? AND planner_result IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
                (row, index) -> List.of(row.getString(1), row.getString(2)), accountId);
        if (old.isEmpty()) return json.createObjectNode();
        ObjectNode result = (ObjectNode) json.readTree(old.getFirst().getFirst());
        result.set("answers", json.readTree(old.getFirst().get(1)));
        result.set("discussion", discussionHistory(result));
        save(accountId, result);
        return result;
    }

    @Transactional(timeout = 180)
    public JsonNode plan(String accountId, JsonNode input) {
        if (!input.isObject()) throw bad("A planning command is required.");
        String operation = input.path("operationId").asText();
        if (operation.isBlank() || operation.length() > 250) throw bad("A valid operation reference is required.");
        String hash = hash(input);
        // Serialize commands for an account before checking for completed retries.
        database.update("UPDATE customer_accounts SET id=id WHERE id=?", accountId);
        var replay = database.query(
                "SELECT payload_hash,response_json FROM customer_workspace_operations WHERE account_id=? AND operation_id=?",
                (row, index) -> List.of(row.getString(1), row.getString(2)), accountId, operation);
        if (!replay.isEmpty()) {
            if (!hash.equals(replay.getFirst().getFirst())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This operation has already been used for a different request.");
            }
            return json.readTree(replay.getFirst().get(1));
        }

        String workCase = input.path("workCaseId").asText();
        JsonNode previous = null;
        if (workCase.isBlank()) {
            String request = input.path("request").asText().trim();
            if (request.length() < 10 || request.length() > 2000) {
                throw bad("Describe your request in 10 to 2000 characters.");
            }
        } else {
            requireOwnership(accountId, workCase);
            previous = json.readTree(database.queryForObject(
                    "SELECT planner_result FROM customer_workspaces WHERE work_case_id=? AND account_id=?",
                    String.class, workCase, accountId));
        }

        String questionId = input.path("discussionQuestionId").asText();
        JsonNode answeredQuestion = null;
        JsonNode answer = input.path("answers").path(questionId);
        if (!questionId.isBlank()) {
            if (previous != null) {
                for (JsonNode question : previous.path("analysis").path("questions")) {
                    if (questionId.equals(question.path("id").asText())) answeredQuestion = question;
                }
            }
            if (answeredQuestion == null || !(answer.isBoolean() || answer.isTextual())
                    || (answer.isTextual() && (answer.asText().trim().length() < 2 || answer.asText().length() > 300))) {
                throw bad("This question has changed. Reopen your saved conversation before answering.");
            }
            if ("boolean".equals(answeredQuestion.path("type").asText()) && !answer.isBoolean()) {
                throw bad("Choose Yes or No for this question.");
            }
        }

        ObjectNode command = (ObjectNode) input.deepCopy();
        command.remove("discussionQuestionId");
        ObjectNode result = (ObjectNode) planner.plan(command).deepCopy();
        if (!workCase.isBlank() && !workCase.equals(result.path("workCaseId").asText())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Doneeo returned a different WorkCase.");
        }
        ArrayNode discussion = previous == null ? json.createArrayNode() : discussionHistory(previous);
        if (previous == null) {
            addMessage(discussion, "user", input.path("request").asText());
            addMessage(discussion, "assistant", result.path("analysis").path("summary").asText());
        }
        if (answeredQuestion != null) {
            addMessage(discussion, "assistant", answeredQuestion.path("label").asText());
            addMessage(discussion, "user", answer.isBoolean() ? (answer.asBoolean() ? "Yes" : "No") : answer.asText());
        }
        result.set("discussion", discussion);
        save(accountId, result);
        database.update(
                "INSERT INTO customer_workspace_operations(account_id,operation_id,payload_hash,response_json) VALUES (?,?,?,?)",
                accountId, operation, hash, json.writeValueAsString(result));
        return result;
    }

    @Transactional(timeout = 180)
    public JsonNode operation(String accountId, JsonNode input) {
        String action = input.path("action").asText();
        String reference;
        String workCase;
        if ("create_work_order".equals(action)) {
            JsonNode payload = input.path("payload");
            workCase = payload.path("work_case_id").asText();
            requireOwnership(accountId, workCase);
            reference = payload.path("public_reference").asText();
            if (reference.isBlank() || reference.length() > 100) throw bad("A work order reference is required.");
            var existing = database.query(
                    "SELECT account_id FROM customer_work_orders WHERE public_reference=?",
                    (row, index) -> row.getString(1), reference);
            if (!existing.isEmpty() && !accountId.equals(existing.getFirst())) throw missing();
        } else if ("work_order_status".equals(action) && "completed".equals(input.path("status").asText())) {
            reference = input.path("reference").asText();
            var owned = database.query(
                    "SELECT work_case_id FROM customer_work_orders WHERE public_reference=? AND account_id=?",
                    (row, index) -> row.getString(1), reference, accountId);
            if (owned.isEmpty()) throw missing();
            workCase = owned.getFirst();
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This action is not available in the customer workspace.");
        }
        JsonNode result = planner.call("/api/operations", input);
        if ("create_work_order".equals(action)) {
            Integer found = database.queryForObject("SELECT COUNT(*) FROM customer_work_orders WHERE public_reference=?",
                    Integer.class, reference);
            if (found == null || found == 0) {
                database.update("INSERT INTO customer_work_orders(public_reference,account_id,work_case_id) VALUES (?,?,?)",
                        reference, accountId, workCase);
            }
        }
        JsonNode control = result.path("control");
        if (control.isObject()) {
            var saved = database.query(
                    "SELECT planner_result FROM customer_workspaces WHERE work_case_id=? AND account_id=?",
                    (row, index) -> row.getString(1), workCase, accountId);
            ObjectNode updated = (ObjectNode) json.readTree(saved.getFirst());
            for (String field : List.of("state", "stateVersion", "currentLayerId")) {
                if (control.has(field)) updated.set(field, control.path(field));
            }
            save(accountId, updated);
        }
        return result;
    }

    private void requireOwnership(String accountId, String workCase) {
        Integer count = database.queryForObject(
                "SELECT COUNT(*) FROM customer_workspaces WHERE work_case_id=? AND account_id=?",
                Integer.class, workCase, accountId);
        if (count == null || count == 0) {
            // Adopt an older saved chat only after matching its account owner.
            latest(accountId);
            count = database.queryForObject(
                    "SELECT COUNT(*) FROM customer_workspaces WHERE work_case_id=? AND account_id=?",
                    Integer.class, workCase, accountId);
        }
        if (count == null || count == 0) throw missing();
    }

    private void save(String accountId, JsonNode result) {
        String workCase = result.path("workCaseId").asText();
        var owners = database.query("SELECT account_id FROM customer_workspaces WHERE work_case_id=?",
                (row, index) -> row.getString(1), workCase);
        if (!owners.isEmpty() && !owners.getFirst().equals(accountId)) throw missing();
        String encoded = json.writeValueAsString(result);
        String now = Instant.now().toString();
        if (owners.isEmpty()) {
            database.update("INSERT INTO customer_workspaces(work_case_id,account_id,job_order_id,planner_result,updated_at) VALUES (?,?,?,?,?)",
                    workCase, accountId, result.path("jobOrderId").asText(), encoded, now);
        } else {
            database.update("UPDATE customer_workspaces SET planner_result=?,updated_at=? WHERE work_case_id=? AND account_id=?",
                    encoded, now, workCase, accountId);
        }
    }

    private String hash(JsonNode input) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(json.writeValueAsString(input).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    private ArrayNode discussionHistory(JsonNode snapshot) {
        if (snapshot != null && snapshot.path("discussion").isArray()) {
            return (ArrayNode) snapshot.path("discussion").deepCopy();
        }
        ArrayNode messages = json.createArrayNode();
        if (snapshot != null) {
            addMessage(messages, "user", snapshot.path("analysis").path("sourceText").asText());
            addMessage(messages, "assistant", snapshot.path("analysis").path("summary").asText());
        }
        return messages;
    }

    private void addMessage(ArrayNode messages, String role, String text) {
        if (!text.isBlank()) messages.addObject().put("id", UUID.randomUUID().toString()).put("role", role).put("text", text);
    }

    private ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "This work could not be found in your account.");
    }

    private ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
