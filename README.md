# Maintenance Work Order Tracker

A small local web app for tracking building maintenance work orders. It uses Node.js and Express, stores data in a JSON file, and serves a single-page UI you can run on your laptop.

This is a sample project for my freelance profile. The building name and work orders are fictional demo data, not a client system.

Built with AI-assisted development; reviewed and tested by me.

## What it does

- Create, edit, close, and delete work orders
- Track status (Open, In Progress, On Hold, Closed), priority, category, location, assignee, and due date
- Search and filter the list
- Show counts for open, urgent, and overdue work
- Persist everything to `data/orders.json` (seeded from `data/orders.seed.json` on first run)

The demo is set in a fictional office building, "Harborview Offices," and includes typical facilities work: HVAC filters, a restroom leak, a dock leveler, a generator test.

## How to run

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000). A screenshot of the seeded demo is in `docs/thumbnail.png`. To use another port:

```bash
PORT=4000 npm start
```

## Tests

```bash
npm test
```

The tests cover the JSON store (create, validation, filters, overdue counts, persistence) and the HTTP API, including the seeded demo data.

## License

MIT
