package com.doneeo.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ExecutorNotifications {
    public record Notification(String id, String jobId, String title, String message, long createdAt, boolean seen) {}
    private final JdbcTemplate database;

    public ExecutorNotifications(JdbcTemplate database) { this.database = database; }

    public void send(String account, String job, String title, String message) {
        database.update("INSERT INTO executor_notifications(id,account_id,job_id,title,message,created_at,seen) VALUES (?,?,?,?,?,?,0)",
                UUID.randomUUID().toString(), account, job, title, message, Instant.now().toEpochMilli());
    }

    public List<Notification> list(String account) {
        return database.query("SELECT * FROM executor_notifications WHERE account_id=? ORDER BY created_at DESC LIMIT 100",
                (row, i) -> new Notification(row.getString("id"), row.getString("job_id"), row.getString("title"),
                        row.getString("message"), row.getLong("created_at"), row.getBoolean("seen")), account);
    }

    public void seen(String account, String id) {
        database.update("UPDATE executor_notifications SET seen=1 WHERE account_id=? AND id=?", account, id);
    }
}
