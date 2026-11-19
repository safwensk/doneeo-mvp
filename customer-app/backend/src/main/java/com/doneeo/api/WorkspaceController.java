package com.doneeo.api;

import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
public class WorkspaceController {
    private final CustomerWorkspace workspace;
    private final PlannerGateway planner;

    public WorkspaceController(CustomerWorkspace workspace, PlannerGateway planner) {
        this.workspace = workspace;
        this.planner = planner;
    }

    @GetMapping("/api/workspace/latest")
    public JsonNode latest(Principal principal) { return workspace.latest(principal.getName()); }

    @PostMapping("/api/plan")
    public JsonNode plan(Principal principal, @RequestBody JsonNode command) {
        return workspace.plan(principal.getName(), command);
    }

    @PostMapping("/api/operations")
    public JsonNode operation(Principal principal, @RequestBody JsonNode command) {
        return workspace.operation(principal.getName(), command);
    }

    @PostMapping("/api/route")
    public JsonNode route(@RequestBody JsonNode command) {
        return planner.call("/api/route", command);
    }
}
