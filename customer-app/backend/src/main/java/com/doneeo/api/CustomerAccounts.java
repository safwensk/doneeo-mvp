package com.doneeo.api;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class CustomerAccounts {
    public record User(String id, String name, String email) {}
    public record Credentials(String name, String email, String password) {}
    private record Account(User user, String passwordHash) {}
    private final JdbcTemplate database;
    private final PasswordEncoder passwords;
    private final SecurityContextRepository contexts;
    private final String dummyHash;

    public CustomerAccounts(JdbcTemplate database, PasswordEncoder passwords,
                            SecurityContextRepository contexts) {
        this.database = database;
        this.passwords = passwords;
        this.contexts = contexts;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @GetMapping("/session")
    public Map<String, Object> session(Authentication authentication, CsrfToken csrf) {
        User user = authentication == null ? null : findUser(authentication.getName());
        return Map.of("user", user == null ? Map.of() : user,
                "csrfToken", csrf.getToken(), "csrfHeader", csrf.getHeaderName());
    }

    @PostMapping("/register")
    public User register(@RequestBody Credentials input, HttpServletRequest request,
                         HttpServletResponse response) {
        String email = validatedEmail(input.email());
        String password = input.password();
        String name = input.name() == null ? "" : input.name().trim();
        if (name.length() < 1 || name.length() > 80 || password == null
                || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Enter your name and a password of at least 12 characters (up to 72 bytes).");
        }
        User user = new User(UUID.randomUUID().toString(), name, email);
        try {
            database.update("INSERT INTO customer_accounts(id,email,display_name,password_hash) VALUES (?,?,?,?)",
                    user.id(), user.email(), user.name(), passwords.encode(password));
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This email already has an account. Please log in.");
        }
        signIn(user, request, response);
        return user;
    }

    @PostMapping("/login")
    public User login(@RequestBody Credentials input, HttpServletRequest request,
                      HttpServletResponse response) {
        String email = validatedEmail(input.email());
        String supplied = input.password() == null ? "" : input.password();
        if (supplied.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        }
        List<Account> matches = database.query(
                "SELECT * FROM customer_accounts WHERE email=?",
                (row, index) -> new Account(new User(row.getString("id"),
                        row.getString("display_name"), row.getString("email")),
                        row.getString("password_hash")), email);
        Account account = matches.isEmpty() ? null : matches.getFirst();
        boolean valid = passwords.matches(supplied, account == null ? dummyHash : account.passwordHash());
        if (account == null || !valid) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        }
        signIn(account.user(), request, response);
        return account.user();
    }

    private String validatedEmail(String email) {
        String value = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (value.length() > 254 || !value.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        return value;
    }

    private User findUser(String id) {
        return database.query("SELECT id,display_name,email FROM customer_accounts WHERE id=?",
                (row, index) -> new User(row.getString("id"), row.getString("display_name"),
                        row.getString("email")), id).stream().findFirst().orElse(null);
    }

    private void signIn(User user, HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true);
        request.changeSessionId();
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                user.id(), null, List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }
}
