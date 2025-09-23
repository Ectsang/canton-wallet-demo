# Canton Console Commands for Token Creation

## Accessing Canton Console in LocalNet

Since the console profile isn't easily accessible, we can interact with Canton directly through the running container.

## Option 1: Execute Canton Commands via Docker

### Check available participants

```bash
docker exec canton /app/bin/canton daemon \
  --config /app/app.conf \
  --bootstrap-script <(echo "participants.all.foreach(p => println(s\"Participant: ${p.name}\"))")
```

### Upload a DAML Archive (DAR)

```bash
# First, you need a DAR file with your token contracts
# Then upload it:
docker exec canton /app/bin/canton daemon \
  --config /app/app.conf \
  --bootstrap-script <(echo "
    val participant = participants.sv
    participant.dars.upload(\"/path/to/your/token.dar\")
  ")
```

## Option 2: Use the Admin API

The Canton admin API is exposed on various ports:

- SV participant: `localhost:4902`
- App Provider participant: `localhost:3902`
- App User participant: `localhost:2902`

### Upload DAR via Admin API

```bash
curl -X POST http://localhost:4902/v1/packages \
  -H "Content-Type: application/octet-stream" \
  --data-binary @your-token.dar
```

## Option 3: Direct Ledger API Access

Since Canton LocalNet uses unsafe authentication, you can interact directly with the ledger API.

### List parties

```bash
curl -X GET http://localhost:4901/v1/parties \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwLCJpc3MiOiJ1bnNhZmUtYXV0aCJ9.example"
```

## The Reality: Why This Doesn't Help

Even with console access, you still face these limitations:

1. **Token Creation Requires DAML Contracts**: You need to write DAML code for your token
2. **Registry API Integration**: The token needs to be registered with the Registry API Server
3. **Transfer Factory Setup**: You need to deploy transfer factory contracts
4. **Admin Infrastructure**: The token admin needs proper infrastructure

## What You CAN Do

1. **Use Existing Canton Coin**: It's already deployed with admin `DSO::12207edc...`
2. **Mock Tokens**: Use the mock system in your app for development
3. **Full Setup**: Write DAML contracts, deploy them, and set up Registry API (complex)

## Example: Minimal Token DAML

```daml
module Token where

import DA.Map as Map

template Token
  with
    issuer : Party
    name : Text
    symbol : Text
    decimals : Int
  where
    signatory issuer

template Holding
  with
    owner : Party
    token : ContractId Token
    amount : Decimal
  where
    signatory owner
    observer token.issuer
```

But this still requires:

- Compiling to DAR
- Uploading to Canton
- Setting up Registry API endpoints
- Implementing transfer logic
- And much more...

## Conclusion

Canton LocalNet is not designed for arbitrary token creation by developers. It's an institutional-grade system where token creation is a governance process, not a developer feature.
