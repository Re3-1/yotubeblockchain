# Forecast microservice

Tiny FastAPI service that returns a 7-day price forecast for a channel token.

```bash
cd forecast
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Example:

```bash
curl -X POST http://localhost:8000/predict \
  -H 'content-type: application/json' \
  -d '{"horizon":7,"series":[{"date":"2026-01-01","avgPrice":0.01,"subscribers":10000,"views":200000},{"date":"2026-01-02","avgPrice":0.011,"subscribers":10500,"views":210000}]}'
```

The Node backend proxies this via `/forecast/:token`.
