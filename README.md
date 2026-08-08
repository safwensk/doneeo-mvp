# Doneeo Intelligence — Python MVP

A functional, dependency-free implementation of the Doneeo customer-planning and executor workflow. It uses Python's built-in HTTP server and SQLite, so it runs with a standard Python 3 installation.

## Run

```bash
python3 server.py
```

Open `http://127.0.0.1:8080`.

## Test

```bash
python3 -m unittest discover -s tests -v
```

## Implemented workflow

- Request classification and preservation of supplied facts
- Ordered multi-stop task decomposition
- Arrival and deadline extraction
- Adaptive missing-information questions
- Conditional elevator questions after an upper-floor answer
- Equipment, vehicle and rental-gap planning
- Three differentiated matched execution options
- Exact milestone times before simulated payment
- Provider acceptance or transparent rematching
- Readiness gate for the executor team and equipment
- Live milestone advancement and downstream delay recalculation
- SQLite-persisted work orders and final variance report

## API

- `POST /api/analyze`
- `POST /api/offers`
- `GET/POST /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders/{id}/{accept|decline|readiness|start|advance|delay}`
- `GET /api/health`

This version uses a deterministic travel-time adapter for repeatable tests. A Google Routes adapter can be added behind the same plan-building interface.
