package com.doneeo.api;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/executor/profile")
public class ExecutorProfiles {
    public record Qualifications(String trade, String region) {}
    public record Hours(DayOfWeek day, String start, String end) {}
    public record Address(String street, String unit, String city, String region, String postalCode, String country) {}
    public record WorkSkill(String label, String level) {}
    public record Vehicle(String type, String cargo) {}
    public record Setup(Address address, int radiusKm, List<WorkSkill> workTypes, List<String> kit,
                        Vehicle vehicle, Boolean driverLicensed, List<String> blockedDates, String about) {}
    public record Profile(String role, String serviceArea, String skills, String equipment,
                          String timeZone, List<Hours> availability, Qualifications qualifications, Setup setup) {}
    public record ProfileUpdate(String accountId, Profile profile) {}

    private final JdbcTemplate database;
    private final ObjectMapper json;
    private final ExecutorAssets assets;

    public ExecutorProfiles(JdbcTemplate database, ObjectMapper json, ExecutorAssets assets) {
        this.database = database;
        this.json = json;
        this.assets = assets;
    }

    @GetMapping
    public ResponseEntity<Profile> get(Authentication account) {
        Profile profile = find(account.getName());
        return profile == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(profile);
    }

    Profile find(String account) {
        return findIn(account, "executor_profiles");
    }

    private Profile findIn(String account, String table) {
        return database.query("SELECT profile_json FROM " + table + " WHERE account_id=?",
                (row, index) -> json.readValue(row.getString(1), Profile.class), account)
                .stream().findFirst().orElse(null);
    }

    @GetMapping("/draft")
    public ResponseEntity<Profile> draft(Authentication account) {
        Profile profile = findIn(account.getName(), "executor_profile_drafts");
        return profile == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(profile);
    }

    @PostMapping("/draft")
    @Transactional
    public Profile saveDraft(Authentication account, @RequestBody ProfileUpdate input) {
        String owner = account.getName();
        requireAccount(owner, input.accountId());
        if (input.profile() == null) throw invalid("Enter your profile details.");
        String draft = json.writeValueAsString(input.profile());
        if (draft.length() > 16000) throw invalid("Your draft is too large. Shorten the profile details.");
        assets.lockAccount(owner);
        write(owner, draft, "executor_profile_drafts");
        return input.profile();
    }

    @PostMapping
    @Transactional
    public Profile save(Authentication account, @RequestBody ProfileUpdate input) {
        String accountId = account.getName();
        requireAccount(accountId, input.accountId());
        if (input.profile() == null) throw invalid("Enter your profile details.");
        assets.lockAccount(accountId);
        Profile existing = find(accountId);
        if (existing != null && existing.setup() != null && input.profile().setup() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Reopen the current worker profile before editing.");
        }
        Profile profile = validate(input.profile());
        if (profile.setup() != null) {
            var documents = assets.documents(accountId);
            requireDocument(documents, "identity", "Upload an identity document to submit your profile.");
            if ("professional".equals(profile.role())) requireDocument(documents, "trade", "Upload your trade licence to submit your profile.");
            if (profile.setup().driverLicensed()) requireDocument(documents, "driver", "Upload your driver's licence to submit your profile.");
            if (existing != null && existing.setup() != null && existing.qualifications() != null
                    && profile.qualifications() != null && !Objects.equals(existing.qualifications(), profile.qualifications())) {
                database.update("UPDATE executor_assets SET status='NEEDS_UPDATE',note=? WHERE account_id=? AND kind='trade' AND status='VERIFIED'",
                        "Upload a licence for the updated trade and region.", accountId);
            }
        }
        write(accountId, json.writeValueAsString(profile), "executor_profiles");
        database.update("DELETE FROM executor_profile_drafts WHERE account_id=?", accountId);
        return profile;
    }

    private void write(String account, String document, String table) {
        if (database.update("UPDATE " + table + " SET profile_json=? WHERE account_id=?", document, account) == 0) {
            database.update("INSERT INTO " + table + "(account_id,profile_json) VALUES (?,?)", account, document);
        }
    }

    private static void requireDocument(List<ExecutorAssets.Document> documents, String kind, String message) {
        if (documents.stream().noneMatch(doc -> doc.kind().equals(kind))) throw invalid(message);
    }

    static void requireAccount(String principal, String supplied) {
        if (!principal.equals(supplied)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The signed-in account changed. Reopen your workspace before continuing.");
        }
    }

    private static Profile validate(Profile input) {
        if (!"helper".equals(input.role()) && !"professional".equals(input.role())) {
            throw invalid("Choose Local helper or Licensed professional.");
        }
        Setup setup = input.setup() == null ? null : validateSetup(input.setup());
        String serviceArea = setup == null ? text(input.serviceArea(), "your service area", 150, true) : setup.address().city();
        String skills = setup == null ? text(input.skills(), "your skills", 600, true)
                : String.join(", ", setup.workTypes().stream().map(WorkSkill::label).toList());
        String equipment = setup == null ? text(input.equipment(), "your equipment", 600, false) : String.join(", ", setup.kit());
        String timeZone = text(input.timeZone(), "your time zone", 80, true);
        if (!ZoneId.getAvailableZoneIds().contains(timeZone)) {
            throw invalid("Choose a valid time zone for your availability.");
        }
        Qualifications qualifications = null;
        if ("professional".equals(input.role())) {
            if (input.qualifications() == null) {
                throw invalid("Enter your licensed trade and licensing region.");
            }
            qualifications = new Qualifications(
                    text(input.qualifications().trade(), "your licensed trade", 120, true),
                    text(input.qualifications().region(), "your licensing region", 120, true));
        }
        return new Profile(input.role(), serviceArea, skills, equipment, timeZone,
                validateAvailability(input.availability()), qualifications, setup);
    }

    private static Setup validateSetup(Setup input) {
        Address a = input.address();
        if (a == null) throw invalid("Enter the address you normally work from.");
        Address address = new Address(text(a.street(), "your street address", 150, true), text(a.unit(), "your unit", 35, false),
                text(a.city(), "your city", 80, true), text(a.region(), "your province or state", 80, true),
                text(a.postalCode(), "your postal code", 24, true), text(a.country(), "your country", 80, true));
        if (input.radiusKm() < 1 || input.radiusKm() > 150) throw invalid("Choose a travel radius between 1 and 150 km.");
        if (input.workTypes() == null || input.workTypes().isEmpty() || input.workTypes().size() > 24) {
            throw invalid("Choose between 1 and 24 types of work.");
        }
        var names = new HashSet<String>();
        var workTypes = new ArrayList<WorkSkill>();
        for (WorkSkill skill : input.workTypes()) {
            if (skill == null || (!"assist".equals(skill.level()) && !"independent".equals(skill.level()))) throw invalid("Set an ability level for each skill.");
            String label = text(skill.label(), "the work type", 70, true);
            if (!names.add(label.toLowerCase(Locale.ROOT))) throw invalid("List each work type once.");
            workTypes.add(new WorkSkill(label, skill.level()));
        }
        if (input.kit() == null || input.kit().size() > 30) throw invalid("List up to 30 equipment items.");
        var kit = input.kit().stream().map(item -> text(item, "the equipment name", 70, true)).distinct().toList();
        Vehicle vehicle = input.vehicle();
        if (vehicle != null) vehicle = new Vehicle(text(vehicle.type(), "the vehicle type", 45, true),
                text(vehicle.cargo(), "your cargo space", 150, false));
        if (input.driverLicensed() == null) throw invalid("Tell us if you have a driver's licence.");
        if (input.blockedDates() == null || input.blockedDates().size() > 100) throw invalid("Choose up to 100 dates to block.");
        List<String> blocked;
        try {
            blocked = input.blockedDates().stream().map(date -> LocalDate.parse(text(date, "the blocked date", 10, true)).toString())
                    .distinct().sorted().toList();
        } catch (DateTimeParseException exception) {
            throw invalid("Enter each blocked date as a valid calendar date.");
        }
        return new Setup(address, input.radiusKm(), List.copyOf(workTypes), kit, vehicle, input.driverLicensed(), blocked,
                text(input.about(), "your profile description", 600, false));
    }

    private static List<Hours> validateAvailability(List<Hours> hours) {
        if (hours == null || hours.size() > 7) {
            throw invalid("Choose up to one time window per day.");
        }
        var days = EnumSet.noneOf(DayOfWeek.class);
        var ordered = new ArrayList<Hours>();
        for (Hours slot : hours) {
            if (slot == null || slot.day() == null || !days.add(slot.day())) {
                throw invalid("Choose up to one time window per day.");
            }
            if (!time(slot.start()).isBefore(time(slot.end()))) {
                throw invalid("Availability must end after it starts on the same day.");
            }
            ordered.add(slot);
        }
        ordered.sort(Comparator.comparing(Hours::day));
        return List.copyOf(ordered);
    }

    private static LocalTime time(String value) {
        if (value != null && value.matches("[0-9]{2}:[0-9]{2}")) {
            try {
                return LocalTime.parse(value);
            } catch (DateTimeParseException ignored) {
                // Use the same validation message for malformed and out-of-range times.
            }
        }
        throw invalid("Enter a start and end time for each available day.");
    }

    static String text(String value, String label, int max, boolean required) {
        String normalized = value == null ? "" : value.strip();
        if (required && normalized.isEmpty()) throw invalid("Enter " + label + ".");
        if (normalized.length() > max) throw invalid("Use " + max + " characters or fewer for " + label + ".");
        return normalized;
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
