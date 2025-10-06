# Uploading DAR to Canton

## Prerequisites
- Canton console running: `make canton-console` (from cn-quickstart directory)
- DAR file built: `daml build --project-root=daml/minimal-token`

## Steps

1. **Copy DAR to console container**:
```bash
docker cp daml/minimal-token/.daml/dist/minimal-token-autoaccept-2.0.0.dar canton-console:/app/dars/
```

2. **Upload to participants** (in Canton console):
```scala
participants.app_provider.dars.upload("dars/minimal-token-autoaccept-2.0.0.dar")
participants.app_user.dars.upload("dars/minimal-token-autoaccept-2.0.0.dar")
```

## Notes
- The console container has `/app/dars/` directory where DARs must be placed
- The console reads files from inside the container, not the host filesystem
- Both app-provider and app-user participants need the DAR for cross-party operations
