package com.doneeo.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class PlannerGateway {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PlannerGateway.class);
    private final String baseUrl;
    private final ObjectMapper json;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1).build();

    public PlannerGateway(@Value("${doneeo.planner.url}") String baseUrl, ObjectMapper json) {
        this.baseUrl = baseUrl;
        this.json = json;
    }

    public JsonNode plan(JsonNode payload) {
        JsonNode result = call("/api/plan", payload);
        if (!result.path("analysis").isObject() || result.path("workCaseId").asText().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Doneeo returned an incomplete plan. Please retry.");
        }
        return result;
    }

    public JsonNode call(String path, JsonNode payload) {
        try {
            var request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .timeout(Duration.ofSeconds(150))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload)))
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode result = json.readTree(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String message = result.path("error").asText();
                // Authentication failures from a map/model provider are service
                // configuration errors; they do not expire the customer's login.
                int status = response.statusCode() == 401 || response.statusCode() == 403
                        ? 502 : response.statusCode();
                throw new ResponseStatusException(
                        org.springframework.http.HttpStatusCode.valueOf(status),
                        message.isBlank() ? "Doneeo could not update the plan. Please retry." : message.substring(0, Math.min(400, message.length())));
            }
            return result;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Planning was interrupted. Please retry.");
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn("Local planner request failed: {}", exception.toString());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "The Doneeo planning engine is unavailable. Please start the planner and retry.");
        }
    }
}
