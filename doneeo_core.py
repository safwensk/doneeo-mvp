from __future__ import annotations

import json
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


TIME_RE = r"(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)"


def _clock(hour: str, minute: str | None, period: str) -> str:
    return f"{int(hour)}:{int(minute or 0):02d} {period.replace('.', '').upper()}"


def _clock_dt(value: str) -> datetime:
    return datetime.strptime(value, "%I:%M %p")


def add_minutes(value: str, minutes: int) -> str:
    return (_clock_dt(value) + timedelta(minutes=minutes)).strftime("%-I:%M %p")


def minutes_between(start: str, end: str) -> int:
    start_dt, end_dt = _clock_dt(start), _clock_dt(end)
    if end_dt < start_dt:
        end_dt += timedelta(days=1)
    return int((end_dt - start_dt).total_seconds() // 60)


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" ,.;")


def _extract_schedule(text: str) -> dict[str, str | None]:
    date_match = re.search(
        r"\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b",
        text,
        re.I,
    )
    date_label = (date_match.group(1) if date_match else "Requested date").title()
    deadline = re.search(rf"\b(?:finish|complete|done)[^.;\n]{{0,30}}?\b(?:before|by)\s+{TIME_RE}", text, re.I)
    arrival = re.search(rf"\b(?:arrive|start|starting|begin|be there)\s+(?:at|by)\s+{TIME_RE}", text, re.I)
    if not arrival:
        arrival = re.search(
            rf"\b(?:today|tomorrow|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^.;\n]{{0,25}}?\bat\s+{TIME_RE}",
            text,
            re.I,
        )
    return {
        "date": date_label,
        "arrival": _clock(arrival.group(1), arrival.group(2), arrival.group(3)) if arrival else None,
        "deadline": _clock(deadline.group(1), deadline.group(2), deadline.group(3)) if deadline else None,
    }


def _extract_route(text: str) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []

    def add(location: str, action: str) -> None:
        location = _clean(location)
        location = re.split(r"\b(?:then|finish|before|and I|I cannot)\b", location, flags=re.I)[0]
        location = _clean(location)
        if not location:
            return
        existing = next((node for node in nodes if node["location"].lower() == location.lower()), None)
        if existing:
            if action not in existing["actions"]:
                existing["actions"].append(action)
        else:
            nodes.append({"location": location, "actions": [action]})

    pickup = re.search(
        r"pick\s*up\s+(.+?)\s+(?:already\s+paid\s+for\s+and\s+ready\s+)?(?:at|from)\s+(.+?)(?=,\s*(?:deliver|then|take)|$)",
        text,
        re.I,
    )
    carried = "item"
    if pickup:
        carried = _clean(re.sub(r"\balready\s+paid\s+for\s+and\s+ready\b", "", pickup.group(1), flags=re.I))
        add(pickup.group(2), f"Pick up {carried}")

    delivery = re.search(r"deliver\s+(?:it|them|the\s+\w+)\s+to\s+(.+?)(?=,\s*(?:then|and\s+then|take)|$)", text, re.I)
    if delivery:
        add(delivery.group(1), f"Deliver {carried}")

    for take in re.finditer(r"(?:then\s+)?take\s+(.+?)\s+to\s+(.+?)(?=\.|\s+I\s+cannot|\s+before\s+|$)", text, re.I):
        item = _clean(take.group(1))
        if nodes:
            pickup_action = f"Pick up {item}"
            if pickup_action not in nodes[-1]["actions"]:
                nodes[-1]["actions"].append(pickup_action)
        add(take.group(2), f"Deliver {item}")

    return nodes


def _category(text: str) -> str:
    if re.search(r"\b(move|moving|deliver|pickup|pick up|transport|take .+ to)\b", text, re.I):
        return "Move and delivery"
    if re.search(r"\b(clean|cleaning|vacuum|mop)\b", text, re.I):
        return "Cleaning"
    if re.search(r"\b(assemble|install|mount|repair|shelf|desk)\b", text, re.I):
        return "Assembly and installation"
    if re.search(r"\b(grocer|elder|father|mother|visit|companionship)\b", text, re.I):
        return "Errands and support"
    return "General practical help"


def _equipment(category: str, text: str) -> list[dict[str, Any]]:
    if category == "Move and delivery":
        return [
            {"id": "vehicle", "name": "Cargo van or moving truck", "source": "provider_or_rental", "rental": 85},
            {"id": "straps", "name": "Moving straps", "source": "provider_or_rental", "rental": 10},
            {"id": "blankets", "name": "Protective blankets", "source": "provider_or_rental", "rental": 12},
            {"id": "dolly", "name": "Furniture dolly", "source": "provider_or_rental", "rental": 18},
        ]
    if category == "Cleaning":
        return [
            {"id": "vacuum", "name": "Vacuum cleaner", "source": "customer_provider_or_rental", "rental": 20},
            {"id": "mop", "name": "Mop and bucket", "source": "customer_provider_or_rental", "rental": 12},
            {"id": "products", "name": "Surface-appropriate cleaning products", "source": "customer_or_purchase", "rental": 22},
            {"id": "supplies", "name": "Cloths, gloves and waste bags", "source": "customer_or_purchase", "rental": 14},
        ]
    if category == "Assembly and installation":
        return [
            {"id": "drill", "name": "Drill and bit set", "source": "provider_or_rental", "rental": 18},
            {"id": "level", "name": "Level and measuring kit", "source": "provider_or_rental", "rental": 8},
            {"id": "anchors", "name": "Surface-appropriate anchors", "source": "customer_or_purchase", "rental": 12},
            {"id": "stud_finder", "name": "Stud finder", "source": "provider_or_rental", "rental": 10},
        ]
    return [{"id": "toolkit", "name": "Task-appropriate toolkit", "source": "provider_or_rental", "rental": 15}]


def analyze_request(text: str) -> dict[str, Any]:
    text = _clean(text)
    category = _category(text)
    route = _extract_route(text)
    schedule = _extract_schedule(text)
    cannot_help = bool(re.search(r"\b(?:I|we)\s+(?:cannot|can't|can not|won't)\s+help\s+(?:carry|lift)", text, re.I))
    large = bool(re.search(r"\b(large|heavy|oversized|couch|sofa|table|appliance)\b", text, re.I))
    team_size = 2 if category == "Move and delivery" and (large or cannot_help) else 1

    understood = [
        f"Service type: {category}",
        f"Ordered route: {len(route)} stop{'s' if len(route) != 1 else ''}",
    ]
    if schedule["arrival"]:
        understood.append(f"Committed arrival: {schedule['date']} at {schedule['arrival']}")
    if schedule["deadline"]:
        understood.append(f"Completion deadline: {schedule['date']} by {schedule['deadline']}")
    if cannot_help:
        understood.append("Customer cannot help carry; provider team supplies all lifting labour")

    questions: list[dict[str, Any]] = []
    if not route and category == "Move and delivery":
        questions.extend([
            {"id": "pickup_address", "label": "What is the exact pickup address?", "type": "text"},
            {"id": "delivery_address", "label": "What is the exact delivery address?", "type": "text"},
        ])
    for index, node in enumerate(route):
        questions.append({
            "id": f"floor_{index}",
            "label": f"What is the floor/access level at Stop {index + 1}: {node['location']}?",
            "type": "choice",
            "options": ["Ground floor", "2nd floor", "3rd floor", "4th+ floor"],
            "node": index,
        })
    if not schedule["arrival"]:
        questions.append({"id": "arrival", "label": "What date and arrival time should the provider meet?", "type": "text"})
    if category == "Move and delivery" and not re.search(r"\b(?:dimensions?|measurements?|\d+\s*(?:cm|inches|feet|ft))\b", text, re.I):
        questions.append({"id": "dimensions", "label": "What are the approximate dimensions or disassembly needs of the large item?", "type": "text"})

    return {
        "source_text": text,
        "category": category,
        "title": category,
        "understood_facts": understood,
        "route_nodes": route,
        "schedule": schedule,
        "customer_can_help": not cannot_help if cannot_help else None,
        "team_size": team_size,
        "equipment": _equipment(category, text),
        "questions": questions,
        "gate": "needs_information" if questions else "cleared",
        "notice": "No price or execution estimate is generated until required facts are complete.",
    }


def _handling_minutes(answer: str | None) -> int:
    return {"Ground floor": 18, "2nd floor": 24, "3rd floor": 30, "4th+ floor": 38}.get(answer or "", 22)


def _build_milestones(analysis: dict[str, Any], answers: dict[str, Any], option: str) -> list[dict[str, Any]]:
    start = analysis["schedule"].get("arrival") or answers.get("arrival") or "9:00 AM"
    multiplier = {"budget": 1.12, "recommended": 1.0, "professional": 0.86}[option]
    route = analysis["route_nodes"]
    milestones: list[dict[str, Any]] = []
    cursor = start
    for index, node in enumerate(route):
        if index:
            base_travel = 35 if index == 1 else 20
            travel = max(10, round(base_travel * multiplier))
            finish = add_minutes(cursor, travel)
            milestones.append({"title": f"Travel to Stop {index + 1}", "location": node["location"], "start": cursor, "finish": finish, "minutes": travel, "status": "pending"})
            cursor = finish
        handling = max(12, round(_handling_minutes(answers.get(f"floor_{index}")) * multiplier))
        finish = add_minutes(cursor, handling)
        milestones.append({
            "title": "Execute " + ("pickup" if index == 0 else "delivery and pickup" if index < len(route) - 1 else "final delivery"),
            "location": node["location"],
            "actions": node["actions"],
            "start": cursor,
            "finish": finish,
            "minutes": handling,
            "status": "pending",
        })
        cursor = finish
    finish = add_minutes(cursor, 10)
    milestones.append({"title": "Completion validation", "location": "Doneeo work order", "start": cursor, "finish": finish, "minutes": 10, "status": "pending"})
    return milestones


def build_offers(analysis: dict[str, Any], answers: dict[str, Any]) -> list[dict[str, Any]]:
    unresolved = [q for q in analysis["questions"] if not answers.get(q["id"])]
    dynamic: list[dict[str, Any]] = []
    for q in analysis["questions"]:
        value = answers.get(q["id"])
        if q["id"].startswith("floor_") and value and value != "Ground floor":
            elevator_id = q["id"].replace("floor_", "elevator_")
            if elevator_id not in answers:
                dynamic.append({"id": elevator_id, "label": f"Is there a usable elevator at Stop {int(q['node']) + 1}?", "type": "boolean", "node": q["node"]})
    if unresolved or dynamic:
        return [{"gate": "needs_information", "questions": unresolved + dynamic}]

    configurations = [
        ("budget", "Budget coordinated team", 245, "Two matched solo executors · rental van · longer handling"),
        ("recommended", "Recommended prepared team", 290, "Established two-person team · equipped cargo van · best balance"),
        ("professional", "Professional insured crew", 340, "Commercial crew · enhanced protection · fastest execution"),
    ]
    offers = []
    for key, title, price, reason in configurations:
        milestones = _build_milestones(analysis, answers, key)
        offers.append({
            "id": key,
            "title": title,
            "price": price,
            "reason": reason,
            "team_size": 2,
            "arrival": milestones[0]["start"],
            "finish": milestones[-1]["finish"],
            "total_minutes": sum(item["minutes"] for item in milestones),
            "milestones": milestones,
            "equipment": analysis["equipment"],
        })
    return offers


@dataclass
class OrderStore:
    path: Path

    def __post_init__(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute(
                """CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )"""
            )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path)

    def create(self, analysis: dict[str, Any], answers: dict[str, Any], offer: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now().isoformat(timespec="seconds")
        order = {
            "id": "DN-" + uuid.uuid4().hex[:8].upper(),
            "status": "awaiting_provider",
            "analysis": analysis,
            "answers": answers,
            "offer": offer,
            "readiness": {},
            "active_milestone": 0,
            "delay_minutes": 0,
            "events": [{"type": "payment_authorized", "at": now, "message": "Demo payment authorized; provider offer sent."}],
            "created_at": now,
            "updated_at": now,
        }
        self.save(order)
        return order

    def save(self, order: dict[str, Any]) -> dict[str, Any]:
        order["updated_at"] = datetime.now().isoformat(timespec="seconds")
        with self._connect() as db:
            db.execute(
                "INSERT INTO orders(id,data,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
                (order["id"], json.dumps(order), order["created_at"], order["updated_at"]),
            )
        return order

    def get(self, order_id: str) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute("SELECT data FROM orders WHERE id=?", (order_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT data FROM orders ORDER BY created_at DESC").fetchall()
        return [json.loads(row[0]) for row in rows]


def transition_order(store: OrderStore, order_id: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
    order = store.get(order_id)
    if not order:
        raise KeyError("Order not found")
    now = datetime.now().isoformat(timespec="seconds")

    if action == "accept":
        order["status"] = "accepted"
        message = "Provider accepted the complete work order. Customer notified."
    elif action == "decline":
        order["status"] = "rematching"
        message = "Provider declined. Same confirmed plan sent to the next compatible provider."
    elif action == "readiness":
        order["readiness"].update(payload.get("items", {}))
        required = [item["id"] for item in order["offer"]["equipment"]]
        if payload.get("team_confirmed"):
            order["readiness"]["team"] = True
        if all(order["readiness"].get(item) for item in required) and order["readiness"].get("team"):
            order["status"] = "ready"
            message = "Equipment, vehicle and team readiness confirmed."
        else:
            message = "Readiness saved; missing resources remain visible."
    elif action == "start":
        if order["status"] != "ready":
            raise ValueError("Readiness gate is not complete")
        order["status"] = "in_progress"
        order["offer"]["milestones"][0]["status"] = "active"
        message = "Provider started the live execution plan."
    elif action == "advance":
        if order["status"] != "in_progress":
            raise ValueError("Order is not in progress")
        index = order["active_milestone"]
        milestones = order["offer"]["milestones"]
        milestones[index]["status"] = "complete"
        milestones[index]["actual_finish"] = datetime.now().strftime("%-I:%M %p")
        if index >= len(milestones) - 1:
            order["status"] = "completed"
            message = "Work completed; final report generated."
        else:
            order["active_milestone"] = index + 1
            milestones[index + 1]["status"] = "active"
            message = f"Milestone {index + 1} complete; live plan advanced."
    elif action == "delay":
        delay = max(1, min(180, int(payload.get("minutes", 15))))
        reason = _clean(str(payload.get("reason", "Provider-reported operational delay")))
        order["delay_minutes"] += delay
        start_at = order["active_milestone"]
        for milestone in order["offer"]["milestones"][start_at:]:
            milestone["start"] = add_minutes(milestone["start"], delay)
            milestone["finish"] = add_minutes(milestone["finish"], delay)
        message = f"+{delay} min: {reason}. Affected participants notified."
    else:
        raise ValueError("Unknown action")

    order["events"].append({"type": action, "at": now, "message": message})
    if order["status"] == "completed":
        planned = order["offer"]["total_minutes"]
        actual = planned + order["delay_minutes"]
        order["report"] = {
            "planned_minutes": planned,
            "actual_minutes": actual,
            "variance_minutes": actual - planned,
            "result": "on_time" if actual <= planned else "delayed",
            "events": order["events"],
        }
    return store.save(order)
