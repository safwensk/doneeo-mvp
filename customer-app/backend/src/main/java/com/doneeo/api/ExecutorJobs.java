package com.doneeo.api;

import java.security.Principal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/executor")
public class ExecutorJobs {
    private static final List<String> REQUIRED_KIT = List.of("Drill and bits", "Stud finder", "Level");
    private static final List<String> KIT_MATCHES = List.of("drill", "stud finder", "level");
    private static final List<Step> SAMPLE_STEPS = List.of(
            new Step(0, 15, "Pick up the rental equipment"), new Step(15, 45, "Travel and check access"),
            new Step(45, 195, "Mount, level and check two shelving units"), new Step(195, 225, "Return the rented equipment"));

    public record Step(int fromMinute, int toMinute, String label) {}
    public record Supply(String item, String source, String instructions) {}
    public record Plan(String title, String location, String role, String scope, String access, List<Step> steps,
                       List<String> workerKit, List<String> customerKit, List<Supply> sourced,
                       int workPay, int equipmentPay, String paymentTerms, boolean demo) {}
    public record Note(String id, String kind, String message, long createdAt) {}
    public record Job(String id, long start, long end, String status, int progress, boolean equipmentHold, Plan plan) {}
    public record JobDetails(Job job, List<Note> notes) {}
    public record Workspace(ExecutorProfiles.Profile profile, boolean demo, boolean canReview, boolean matchingReady,
                            List<ExecutorAssets.Document> documents, List<Job> jobs,
                            List<ExecutorNotifications.Notification> notifications) {}
    public record AccountAction(String accountId) {}
    public record JobAction(String accountId, String action, Boolean bringConfirmed, String message, Integer step) {}

    private final JdbcTemplate database;
    private final ObjectMapper json;
    private final ExecutorProfiles profiles;
    private final ExecutorAssets assets;
    private final ExecutorNotifications notifications;

    public ExecutorJobs(JdbcTemplate database, ObjectMapper json, ExecutorProfiles profiles, ExecutorAssets assets,
                        ExecutorNotifications notifications) {
        this.database = database;
        this.json = json;
        this.profiles = profiles;
        this.assets = assets;
        this.notifications = notifications;
    }

    @GetMapping("/workspace")
    public Workspace workspace(Principal principal) {
        String account = principal.getName();
        var profile = profiles.find(account);
        var docs = assets.documents(account);
        boolean ready = profile != null && profile.setup() != null && !profile.availability().isEmpty()
                && verified(docs, "identity") && (!"professional".equals(profile.role()) || verified(docs, "trade"));
        return new Workspace(profile, assets.demo(), assets.canReview(account), ready, docs, jobs(account), notifications.list(account));
    }

    @PostMapping("/notifications/{id}/seen")
    public Workspace seen(Principal principal, @PathVariable String id, @RequestBody AccountAction input) {
        ExecutorProfiles.requireAccount(principal.getName(), input.accountId());
        notifications.seen(principal.getName(), id);
        return workspace(principal);
    }

    @PostMapping("/jobs/sample")
    @Transactional
    public Job sample(Principal principal, @RequestBody AccountAction input) {
        if (!assets.demo()) throw forbidden();
        String account = principal.getName();
        ExecutorProfiles.requireAccount(account, input.accountId());
        assets.lockAccount(account);
        var profile = requireProfile(account);
        var existing = jobs(account).stream().filter(job -> "OFFERED".equals(job.status()) && job.end() > Instant.now().toEpochMilli())
                .findFirst().orElse(null);
        if (existing != null) return existing;

        ZonedDateTime start = sampleWindow(account, profile);
        long end = start.plusMinutes(225).toInstant().toEpochMilli();
        String id = UUID.randomUUID().toString();
        var brought = new ArrayList<String>();
        var sourced = new ArrayList<Supply>();
        for (int i = 0; i < REQUIRED_KIT.size(); i++) {
            String needle = KIT_MATCHES.get(i);
            String item = REQUIRED_KIT.get(i);
            if (profile.setup().kit().stream().anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(needle))) brought.add(item);
            else sourced.add(sampleSupply(item, id));
        }
        sourced.add(sampleSupply("6-foot step ladder", id));
        Plan plan = new Plan("Mount storage shelving", profile.serviceArea(), "Solo worker",
                "Install and level two customer-provided shelving units, check they are secure and leave the work area tidy.",
                "Check access with the customer before starting. Confirm the wall and mounting points before work begins.", SAMPLE_STEPS,
                brought, List.of("Two shelving units", "Mounting brackets"), sourced, 12000, 2500,
                "Sample payout after completion review. Doneeo covers the arranged equipment. No real payment is made in this preview.", true);
        database.update("INSERT INTO executor_jobs(id,account_id,start_at,end_at,status,progress,equipment_hold,plan_json) VALUES (?,?,?,?,'OFFERED',0,0,?)",
                id, account, start.toInstant().toEpochMilli(), end, json.writeValueAsString(plan));
        notifications.send(account, id, "New job offer", plan.title());
        return requireJob(account, id);
    }

    @GetMapping("/jobs/{id}")
    public JobDetails details(Principal principal, @PathVariable String id) {
        return details(principal.getName(), id);
    }

    @PostMapping("/jobs/{id}")
    @Transactional
    public JobDetails action(Principal principal, @PathVariable String id, @RequestBody JobAction input) {
        String account = principal.getName();
        ExecutorProfiles.requireAccount(account, input.accountId());
        assets.lockAccount(account);
        Job job = requireJob(account, id);
        if (input.action() == null) throw bad("Choose a job action.");
        switch (input.action()) {
            case "accept" -> accept(account, job, Boolean.TRUE.equals(input.bringConfirmed()));
            case "decline" -> {
                if (!"DECLINED".equals(job.status())) {
                    requireStatus(job, "OFFERED");
                    status(account, job, "DECLINED");
                }
            }
            case "question", "issue" -> note(job.id(), input.action(), ExecutorProfiles.text(input.message(), "your message", 800, true));
            case "missing" -> {
                requireStatus(job, "OFFERED");
                note(job.id(), "missing", ExecutorProfiles.text(input.message(), "the missing equipment", 800, true));
                database.update("UPDATE executor_jobs SET equipment_hold=1 WHERE id=? AND account_id=?", id, account);
            }
            case "resolve_sample_equipment" -> resolveSampleEquipment(account, job);
            case "advance" -> advance(account, job, input.step());
            case "complete_sample" -> {
                requireDemo(job);
                if (!"COMPLETED".equals(job.status())) {
                    requireStatus(job, "REVIEW");
                    status(account, job, "COMPLETED");
                    notifications.send(account, id, "Sample job completed", job.plan().title());
                }
            }
            default -> throw bad("Choose a supported job action.");
        }
        return details(account, id);
    }

    private void accept(String account, Job job, boolean bringConfirmed) {
        if (List.of("UPCOMING", "IN_PROGRESS", "REVIEW", "COMPLETED").contains(job.status())) return;
        requireStatus(job, "OFFERED");
        if (job.equipmentHold()) throw conflict("Doneeo needs to update the equipment plan before you accept.");
        if (!job.plan().workerKit().isEmpty() && !bringConfirmed) throw bad("Confirm the equipment you can bring before accepting.");
        var profile = requireProfile(account);
        if (!job.plan().demo()) {
            var docs = assets.documents(account);
            if (!verified(docs, "identity") || ("professional".equals(profile.role()) && !verified(docs, "trade"))) {
                throw conflict("Finish the required verification before accepting this work.");
            }
        }
        var zone = ZoneId.of(profile.timeZone());
        ZonedDateTime start = Instant.ofEpochMilli(job.start()).atZone(zone);
        ZonedDateTime end = Instant.ofEpochMilli(job.end()).atZone(zone);
        if (job.start() <= Instant.now().toEpochMilli() || !available(profile, start, end)
                || overlaps(account, job.start(), job.end())) {
            throw conflict("Your calendar no longer has the full job window available. Review the offer or decline it.");
        }
        status(account, job, "UPCOMING");
        notifications.send(account, job.id(), "Job accepted", "Your full calendar window is reserved for " + job.plan().title() + ".");
    }

    private void resolveSampleEquipment(String account, Job job) {
        requireDemo(job);
        requireStatus(job, "OFFERED");
        if (!job.equipmentHold()) return;
        var plan = job.plan();
        var sourced = new ArrayList<>(plan.sourced());
        var newest = notes(job.id()).stream().filter(note -> "missing".equals(note.kind())).reduce((a, b) -> b).orElseThrow();
        var wanted = newest.message().strip().toLowerCase(Locale.ROOT);
        var kit = new ArrayList<>(plan.workerKit());
        var moved = kit.stream().filter(item -> wanted.contains(item.toLowerCase(Locale.ROOT))).toList();
        for (String item : moved) sourced.add(sampleSupply(item, job.id()));
        if (moved.isEmpty()) sourced.add(sampleSupply("Additional kit requested", job.id()));
        kit.removeAll(moved);
        Plan updated = new Plan(plan.title(), plan.location(), plan.role(), plan.scope(), plan.access(), plan.steps(), kit,
                plan.customerKit(), sourced, plan.workPay(), plan.equipmentPay(), plan.paymentTerms(), true);
        database.update("UPDATE executor_jobs SET equipment_hold=0,plan_json=? WHERE account_id=? AND id=?",
                json.writeValueAsString(updated), account, job.id());
        note(job.id(), "doneeo", "The sample rental plan has been updated. Review the equipment before accepting.");
        notifications.send(account, job.id(), "Equipment plan updated", job.plan().title());
    }

    private void advance(String account, Job job, Integer step) {
        if (step != null && step >= 0 && step < job.progress()) return;
        if (!List.of("UPCOMING", "IN_PROGRESS").contains(job.status()) || step == null || step != job.progress()) {
            throw conflict("Use the current work-order step.");
        }
        int progress = job.progress() + 1;
        String status = progress >= job.plan().steps().size() ? "REVIEW" : "IN_PROGRESS";
        database.update("UPDATE executor_jobs SET progress=?,status=? WHERE account_id=? AND id=?", progress, status, account, job.id());
        if ("REVIEW".equals(status)) notifications.send(account, job.id(), "Completion submitted", job.plan().title());
    }

    private ZonedDateTime sampleWindow(String account, ExecutorProfiles.Profile profile) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of(profile.timeZone()));
        for (int day = 0; day < 28; day++) {
            var date = now.toLocalDate().plusDays(day);
            for (var hours : profile.availability()) {
                if (hours.day() != date.getDayOfWeek()) continue;
                LocalTime preferred = LocalTime.of(8, 45);
                LocalTime beginning = LocalTime.parse(hours.start());
                ZonedDateTime slot = date.atTime(beginning.isAfter(preferred) ? beginning : preferred).atZone(now.getZone());
                if (slot.isBefore(now.plusMinutes(15))) slot = now.plusMinutes(15).truncatedTo(ChronoUnit.MINUTES).plusMinutes(1);
                while (slot.toLocalDate().equals(date) && available(profile, slot, slot.plusMinutes(225))) {
                    long start = slot.toInstant().toEpochMilli(), end = slot.plusMinutes(225).toInstant().toEpochMilli();
                    if (!overlaps(account, start, end)) return slot;
                    slot = slot.plus(Duration.ofMinutes(15));
                }
            }
        }
        throw conflict("Add an available window of at least 3 hours and 45 minutes in Calendar to try the sample offer.");
    }

    private static boolean available(ExecutorProfiles.Profile profile, ZonedDateTime start, ZonedDateTime end) {
        return start.toLocalDate().equals(end.toLocalDate()) && !profile.setup().blockedDates().contains(start.toLocalDate().toString())
                && profile.availability().stream().anyMatch(hours -> hours.day() == start.getDayOfWeek()
                && !start.toLocalTime().isBefore(LocalTime.parse(hours.start())) && !end.toLocalTime().isAfter(LocalTime.parse(hours.end())));
    }

    private boolean overlaps(String account, long start, long end) {
        Integer count = database.queryForObject("""
                SELECT COUNT(*) FROM executor_jobs WHERE account_id=? AND start_at < ? AND end_at > ?
                AND status IN ('UPCOMING','IN_PROGRESS','REVIEW','COMPLETED')
                """, Integer.class, account, end, start);
        return count != null && count > 0;
    }

    private ExecutorProfiles.Profile requireProfile(String account) {
        var profile = profiles.find(account);
        if (profile == null || profile.setup() == null) throw conflict("Finish your worker profile first.");
        return profile;
    }

    private static Supply sampleSupply(String item, String id) {
        return new Supply(item, "Sample Doneeo rental counter", "Pickup and return use reservation DEMO-" + id.substring(0, 6).toUpperCase(Locale.ROOT) + ". Follow the times in this work plan.");
    }

    private void note(String id, String kind, String message) {
        database.update("INSERT INTO executor_job_messages(id,job_id,kind,message,created_at) VALUES (?,?,?,?,?)",
                UUID.randomUUID().toString(), id, kind, message, Instant.now().toEpochMilli());
    }

    private List<Note> notes(String id) {
        return database.query("SELECT * FROM executor_job_messages WHERE job_id=? ORDER BY created_at,id", (row, i) ->
                new Note(row.getString("id"), row.getString("kind"), row.getString("message"), row.getLong("created_at")), id);
    }

    private JobDetails details(String account, String id) { return new JobDetails(requireJob(account, id), notes(id)); }

    private void status(String account, Job job, String status) {
        database.update("UPDATE executor_jobs SET status=? WHERE id=? AND account_id=?", status, job.id(), account);
    }

    private Job requireJob(String account, String id) {
        return database.query("SELECT * FROM executor_jobs WHERE id=? AND account_id=?", (row, i) -> row(row), id, account)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found."));
    }

    private List<Job> jobs(String account) {
        return database.query("SELECT * FROM executor_jobs WHERE account_id=? ORDER BY start_at DESC,id", (row, i) -> row(row), account);
    }

    private Job row(ResultSet row) throws SQLException {
        return new Job(row.getString("id"), row.getLong("start_at"), row.getLong("end_at"), row.getString("status"),
                row.getInt("progress"), row.getInt("equipment_hold") != 0, json.readValue(row.getString("plan_json"), Plan.class));
    }

    private static boolean verified(List<ExecutorAssets.Document> documents, String kind) {
        return documents.stream().anyMatch(doc -> doc.kind().equals(kind) && "VERIFIED".equals(doc.status()));
    }

    private void requireDemo(Job job) { if (!assets.demo() || !job.plan().demo()) throw forbidden(); }
    private static void requireStatus(Job job, String status) { if (!job.status().equals(status)) throw conflict("This job has moved to a different stage."); }
    private static ResponseStatusException forbidden() { return new ResponseStatusException(HttpStatus.FORBIDDEN, "This action is available only for a sample job."); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
