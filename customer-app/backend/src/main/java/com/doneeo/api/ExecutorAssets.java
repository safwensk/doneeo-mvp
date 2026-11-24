package com.doneeo.api;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.GeneralSecurityException;
import java.security.Principal;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/executor")
public class ExecutorAssets {
    private static final int MAX_FILE = 2 * 1024 * 1024;
    private static final List<String> KINDS = List.of("photo", "identity", "trade", "driver");
    private static final SecureRandom RANDOM = new SecureRandom();

    public record Upload(String accountId, String kind, String data, Boolean sample) {}
    public record Document(String kind, String status, String note, String revision, boolean hasFile) {}
    public record Pending(String accountId, String name, Document document) {}
    public record Review(String revision, String status, String note) {}
    private record Stored(String contentType, byte[] encrypted) {}

    private final JdbcTemplate database;
    private final ExecutorNotifications notifications;
    private final boolean demo;
    private final List<String> reviewers;
    private final Path demoKeyPath;
    private SecretKeySpec key;

    public ExecutorAssets(JdbcTemplate database, ExecutorNotifications notifications,
                          @Value("${DONEEO_EXECUTOR_DEMO:false}") boolean demo,
                          @Value("${DONEEO_EXECUTOR_REVIEWERS:}") String reviewers,
                          @Value("${DONEEO_EXECUTOR_DOCUMENT_KEY:}") String configuredKey,
                          @Value("${DONEEO_DATA_DIR:../.local-run}") String dataDir) {
        this.database = database;
        this.notifications = notifications;
        this.demo = demo;
        this.reviewers = Arrays.stream(reviewers.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toList();
        this.demoKeyPath = Path.of(dataDir, "executor-preview.key");
        if (!configuredKey.isBlank()) key = aesKey(Base64.getDecoder().decode(configuredKey));
    }

    public boolean demo() { return demo; }
    public boolean canReview(String account) { return reviewers.contains(account); }

    public List<Document> documents(String account) {
        return database.query("SELECT kind,status,note,revision,encrypted_content IS NOT NULL AS has_file FROM executor_assets WHERE account_id=?",
                (row, i) -> new Document(row.getString("kind"), row.getString("status"), row.getString("note"),
                        row.getString("revision"), row.getBoolean("has_file")), account);
    }

    @PostMapping("/assets")
    @Transactional
    public List<Document> upload(Principal principal, @RequestBody Upload input) throws IOException {
        String account = principal.getName();
        ExecutorProfiles.requireAccount(account, input.accountId());
        String kind = kind(input.kind());
        boolean photo = "photo".equals(kind);
        byte[] encrypted = null;
        String contentType = "application/octet-stream";
        boolean sample = Boolean.TRUE.equals(input.sample());
        if (sample) {
            if (!demo || photo) throw bad("Sample documents are available only in the test preview.");
        } else {
            byte[] bytes = decode(input.data());
            contentType = contentType(bytes);
            if (photo) {
                if (!contentType.startsWith("image/")) throw bad("Choose a JPEG or PNG photo.");
                try {
                    bytes = normalizePhoto(bytes);
                } catch (IOException e) {
                    throw bad("Choose a readable JPEG or PNG photo.");
                }
                contentType = "image/jpeg";
            }
            encrypted = encrypt(bytes);
        }
        lockAccount(account);
        String status = photo ? "READY" : "IN_REVIEW";
        String revision = UUID.randomUUID().toString();
        String note = sample ? "Sample document for this preview" : "";
        if (database.update("""
                UPDATE executor_assets SET content_type=?,encrypted_content=?,status=?,note=?,revision=?
                WHERE account_id=? AND kind=?
                """, contentType, encrypted, status, note, revision, account, kind) == 0) {
            database.update("INSERT INTO executor_assets(account_id,kind,content_type,encrypted_content,status,note,revision) VALUES (?,?,?,?,?,?,?)",
                    account, kind, contentType, encrypted, status, note, revision);
        }
        return documents(account);
    }

    @GetMapping("/assets/{kind}")
    public ResponseEntity<byte[]> ownFile(Principal principal, @PathVariable String kind) {
        return file(principal.getName(), kind(kind));
    }

    @GetMapping("/reviews")
    public List<Pending> reviews(Principal principal) {
        requireReviewer(principal);
        return database.query("""
                SELECT e.account_id,e.kind,e.status,e.note,e.revision,e.encrypted_content IS NOT NULL AS has_file,a.display_name
                FROM executor_assets e JOIN customer_accounts a ON a.id=e.account_id
                WHERE e.status='IN_REVIEW' AND e.encrypted_content IS NOT NULL
                ORDER BY a.display_name,e.kind
                """, (row, i) -> new Pending(row.getString("account_id"), row.getString("display_name"),
                new Document(row.getString("kind"), row.getString("status"), row.getString("note"),
                        row.getString("revision"), row.getBoolean("has_file"))));
    }

    @GetMapping("/reviews/{account}/{kind}")
    public ResponseEntity<byte[]> reviewFile(Principal principal, @PathVariable String account, @PathVariable String kind) {
        requireReviewer(principal);
        if ("photo".equals(kind)) throw missing();
        return file(account, kind(kind));
    }

    @PostMapping("/reviews/{account}/{kind}")
    @Transactional
    public void review(Principal principal, @PathVariable String account, @PathVariable String kind, @RequestBody Review input) {
        requireReviewer(principal);
        if (account.equals(principal.getName()) || "photo".equals(kind)) throw forbidden();
        kind(kind);
        if (!"VERIFIED".equals(input.status()) && !"NEEDS_UPDATE".equals(input.status())) throw bad("Choose a review decision.");
        String note = ExecutorProfiles.text(input.note(), "the update needed", 400, "NEEDS_UPDATE".equals(input.status()));
        lockAccount(account);
        int updated = database.update("""
                UPDATE executor_assets SET status=?,note=? WHERE account_id=? AND kind=? AND revision=?
                AND status='IN_REVIEW' AND encrypted_content IS NOT NULL
                """, input.status(), note, account, kind, input.revision());
        if (updated == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "The document changed. Reopen the review.");
        notifications.send(account, null, "Verification updated", "VERIFIED".equals(input.status())
                ? "A document has been verified." : "A document needs an update. Open Profile & verification for details.");
    }

    private ResponseEntity<byte[]> file(String account, String kind) {
        Stored stored = database.query("SELECT content_type,encrypted_content FROM executor_assets WHERE account_id=? AND kind=?",
                (row, i) -> new Stored(row.getString(1), row.getBytes(2)), account, kind).stream().findFirst().orElseThrow(ExecutorAssets::missing);
        if (stored.encrypted() == null) throw missing();
        String extension = switch (stored.contentType()) {
            case "image/png" -> "png";
            case "image/jpeg" -> "jpg";
            default -> "pdf";
        };
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", ("photo".equals(kind) ? "inline" : "attachment") + "; filename=\"" + kind + "." + extension + "\"")
                .contentType(MediaType.parseMediaType(stored.contentType())).body(decrypt(stored.encrypted()));
    }

    void lockAccount(String account) {
        database.update("UPDATE customer_accounts SET display_name=display_name WHERE id=?", account);
    }

    private void requireReviewer(Principal principal) {
        if (!canReview(principal.getName())) throw forbidden();
    }

    private byte[] encrypt(byte[] data) {
        byte[] iv = new byte[12];
        RANDOM.nextBytes(iv);
        byte[] sealed = cipher(Cipher.ENCRYPT_MODE, iv, data);
        byte[] output = Arrays.copyOf(iv, iv.length + sealed.length);
        System.arraycopy(sealed, 0, output, iv.length, sealed.length);
        return output;
    }

    private byte[] decrypt(byte[] data) {
        return cipher(Cipher.DECRYPT_MODE, Arrays.copyOf(data, 12), Arrays.copyOfRange(data, 12, data.length));
    }

    private byte[] cipher(int mode, byte[] iv, byte[] data) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(mode, storageKey(), new GCMParameterSpec(128, iv));
            return cipher.doFinal(data);
        } catch (GeneralSecurityException | IOException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Private file storage is unavailable.");
        }
    }

    private synchronized SecretKeySpec storageKey() throws IOException {
        if (key != null) return key;
        if (!demo) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Private uploads are awaiting configuration.");
        if (Files.notExists(demoKeyPath)) {
            Path directory = demoKeyPath.toAbsolutePath().getParent();
            Files.createDirectories(directory);
            byte[] generated = new byte[32];
            RANDOM.nextBytes(generated);
            if (Files.getFileStore(directory).supportsFileAttributeView("posix")) {
                Files.createFile(demoKeyPath, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
                Files.write(demoKeyPath, generated, StandardOpenOption.WRITE);
            } else {
                Files.write(demoKeyPath, generated, StandardOpenOption.CREATE_NEW);
            }
        }
        key = aesKey(Files.readAllBytes(demoKeyPath));
        return key;
    }

    private static SecretKeySpec aesKey(byte[] bytes) {
        if (bytes.length != 32) throw new IllegalArgumentException("The executor document key must contain 32 bytes.");
        return new SecretKeySpec(bytes, "AES");
    }

    private static byte[] decode(String data) {
        if (data == null || data.length() > (MAX_FILE + 2) / 3 * 4) throw bad("Choose a file up to 2 MB.");
        try {
            byte[] decoded = Base64.getDecoder().decode(data);
            if (decoded.length <= MAX_FILE && decoded.length > 0) return decoded;
        } catch (IllegalArgumentException ignored) {
            // Report malformed and empty submissions in the same way.
        }
        throw bad("Choose a valid file up to 2 MB.");
    }

    private static String contentType(byte[] data) {
        if (startsWith(data, 0xff, 0xd8, 0xff)) return "image/jpeg";
        if (startsWith(data, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
        if (startsWith(data, '%', 'P', 'D', 'F', '-')) return "application/pdf";
        throw bad("Choose a PDF, JPEG or PNG file.");
    }

    private static boolean startsWith(byte[] data, int... prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if ((data[i] & 0xff) != prefix[i]) return false;
        return true;
    }

    private static byte[] normalizePhoto(byte[] bytes) throws IOException {
        try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw bad("Choose a readable photo.");
            var reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width > 4000 || height > 4000) throw bad("Choose a photo no larger than 4000 pixels per side.");
                int divisor = Math.max(1, (Math.max(width, height) + 639) / 640);
                var params = reader.getDefaultReadParam();
                params.setSourceSubsampling(divisor, divisor, 0, 0);
                var source = reader.read(0, params);
                var image = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
                var graphics = image.createGraphics();
                graphics.drawImage(source, 0, 0, java.awt.Color.WHITE, null);
                graphics.dispose();
                var output = new ByteArrayOutputStream();
                ImageIO.write(image, "jpeg", output);
                return output.toByteArray();
            } finally {
                reader.dispose();
            }
        }
    }

    private static String kind(String value) {
        if (value == null || !KINDS.contains(value)) throw bad("Choose a supported document type.");
        return value;
    }

    private static ResponseStatusException bad(String text) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, text); }
    private static ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found."); }
    private static ResponseStatusException forbidden() { return new ResponseStatusException(HttpStatus.FORBIDDEN, "Document review is restricted."); }
}
