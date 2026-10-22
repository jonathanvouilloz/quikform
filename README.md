# quikform

A small forms server for forms written by AI agents. An agent writes a JSON definition, the CLI validates it, and quikform serves a server-rendered, mobile-first form on the project's own domain. Responses go to one SQLite file per project, with an optional Telegram alert. It ships as a single executable (Bun, Hono, Zod) and uses less than 100 MB of RAM.

The form works without JavaScript; the small client script only adds steps and conditional fields.

## Build

Requires [Bun](https://bun.sh) 1.4 or later.

    bun install
    bun run build      # writes dist/quikform
    bun test

## Layout

    $QUIKFORM_HOME/projects/<slug>/
      project.json     domains, brand, retentionMonths, optional telegram chat
      forms/<id>.json  one definition per form (the filename is the form id)
      data.sqlite      responses
      .env             TELEGRAM_BOT_TOKEN=... (added by the owner, never by the CLI)

`project.json`:

    { "domains": ["forms.example.com"], "brand": { "name": "Example", "accent": "#1f5eff" }, "retentionMonths": 12 }

## Form definition

Minimal example (see `examples/demo/` for steps, conditions and choices):

    {
      "id": "contact",
      "lang": "en",
      "title": "Contact us",
      "privacy": "Your answers are only used to reply to you.",
      "access": "public",
      "notify": { "telegram": false },
      "thankYou": { "title": "Thank you", "body": "We will answer soon." },
      "steps": [
        { "fields": [
          { "id": "email", "type": "email", "label": "Your email", "required": true },
          { "id": "message", "type": "long_text", "label": "Message" }
        ] }
      ]
    }

Fields have an `id`, a `type`, an always-visible `label`, and optional `required` and `showIf`. A required field hidden by `showIf` never blocks submission. Interface languages: `fr`, `en`, `de`, `th`. `quikform check` reports every error in a definition.

## CLI

    quikform project init <slug> --domain <host> [--accent #rrggbb] [--name <brand>]
    quikform check <file.json>
    quikform form put --project <slug> <file.json>
    quikform responses --project <slug> [--form <id>] [--limit 50] [--json]
    quikform serve [--port 8787]

- `form put` validates, then writes `forms/<id>.json` atomically. The version goes up by one when the content changed, and nothing is written when it did not.
- `serve` needs `QUIKFORM_HOME` and `QUIKFORM_SECRET` (32 characters or more). It listens on 127.0.0.1 only, so put a reverse proxy such as Caddy in front. It reloads a project when `project.json` or `.env` changes, or when the `forms/` listing changes, as `form put` does (checked every 10 seconds); a form file edited in place is not detected, so use `form put`. It deletes responses older than `retentionMonths` once a day.
- Exit codes: 0 success, 1 failure, 2 usage error.

## License

MIT
