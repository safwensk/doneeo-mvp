package com.doneeo.api;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
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
    public record Profile(String role, String serviceArea, String skills, String equipment,
                          String timeZone, List<Hours> availability, Qualifications qualifications) {}
    public record ProfileUpdate(String accountId, Profile profile) {}

    private final JdbcTemplate database;
    private final ObjectMapper json;

    public ExecutorProfiles(JdbcTemplate database, ObjectMapper json) {
        this.database = database;
        this.json = json;
    }

    @GetMapping
    public ResponseEntity<Profile> get(Authentication account) {
        return database.query("SELECT profile_json FROM executor_profiles WHERE account_id=?",
                (row, index) -> json.readValue(row.getString(1), Profile.class), account.getName())
                .stream().findFirst().map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    public Profile save(Authentication account, @RequestBody ProfileUpdate input) {
        String accountId = account.getName();
        if (!accountId.equals(input.accountId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The signed-in account changed. Reopen your profile before saving.");
        }
        if (input.profile() == null) throw invalid("Enter your profile details.");
        Profile profile = validate(input.profile());
        String document = json.writeValueAsString(profile);
        String update = "UPDATE executor_profiles SET profile_json=? WHERE account_id=?";
        if (database.update(update, document, accountId) == 0) {
            try {
                int created = database.update("""
                        INSERT INTO executor_profiles(account_id,profile_json)
                        SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM executor_profiles WHERE account_id=?)
                        """, accountId, document, accountId);
                if (created == 1) return profile;
            } catch (DuplicateKeyException concurrentCreate) {
                // A concurrent write created the row already.
            }
            database.update(update, document, accountId);
        }
        return profile;
    }

    private static Profile validate(Profile input) {
        if (!"helper".equals(input.role()) && !"professional".equals(input.role())) {
            throw invalid("Choose Local helper or Licensed professional.");
        }
        String serviceArea = text(input.serviceArea(), "your service area", 150, true);
        String skills = text(input.skills(), "your skills", 600, true);
        String equipment = text(input.equipment(), "your equipment", 600, false);
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
                validateAvailability(input.availability()), qualifications);
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

    private static String text(String value, String label, int max, boolean required) {
        String normalized = value == null ? "" : value.strip();
        if (required && normalized.isEmpty()) throw invalid("Enter " + label + ".");
        if (normalized.length() > max) throw invalid("Use " + max + " characters or fewer for " + label + ".");
        return normalized;
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}

