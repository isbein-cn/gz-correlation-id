# Hapi Correlation ID
Uses for correlation request/response/etc between a few (micro)services.

## Plugin Options
* **strict** - Strict mode. Injects X-Correlation-ID header to all responses.
* **header** - Correlation header name. Default value: *X-Correlation-ID*

## Usage
```javascript
'use strict';

const Hapi = require('hapi');
const CorrelationID = require('@clickdishes/hapi-correlation-id');

const server = Hapi.server();
await server.register(CorrelationID);

server.route({
  path: '/',
  method: '*',
  handler: (request, h) => {
    const correlationId = request.correlationId; // gets correlation id
    
    return h.correlation(h.response('OK')); // correlation for custom response
  }
})
```

