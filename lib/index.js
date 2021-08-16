/*
#***********************************************
#
#      Filename: gz-correlation-id/lib/index.js
#
#        Author: wwj - 318348750@qq.com
#       Company: 甘肃国臻物联网科技有限公司
#   Description: hapi 关联id插件
#        Create: 2021-08-16 13:54:46
# Last Modified: 2021-08-16 13:59:40
#***********************************************
*/
'use strict'

const { v4: generateId } = require('uuid')
const Joi = require('joi')
const Boom = require('@hapi/boom')

const internals = {
  schema: {
    correlationId: Joi.string().guid().required(),
    options: Joi.object({
      correlate: Joi.boolean().default(true),
      mode: Joi.string().valid('request-only', 'response-only', 'proxy', 'all').default('all'),
      header: Joi.string().regex(/^X-[a-zA-Z0-9-]+$/).default('X-Correlation-ID'),
      strict: Joi.boolean().default(true)
    })
  }
}

internals.getOrNewCorrelationId = (headers, header) => headers[header] ? headers[header] : generateId()

internals.onRequest = async function (request, h) {
  if (this.correlate) {
    switch (this.mode) {
      case 'request-only':
      case 'proxy':
      case 'all':
        if (request.headers[this.header]) {
          if (this.strict) {
            try {
              request.headers[this.header] = await Joi.validate(request.headers[this.header], internals.schema.correlationId)
            } catch (e) {
              throw Boom.badRequest(`Invalid ${this.header} header format`, {
                [this.header]: request.headers[this.header]
              })
            }
          }
        } else {
          if (this.mode !== 'proxy') {
            request.headers[this.header] = generateId()
          }
        }
        break
    }
  }
  return h.continue
}

internals.onPreResponse = async function (request, h) {
  if (this.correlate) {
    const response = request.response

    switch (this.mode) {
      case 'response-only':
        if (typeof response === 'object') {
          if (response.isBoom) {
            if (!response.output.headers[this.header]) {
              response.output.headers[this.header] = generateId()
            }
          } else {
            if (!response.headers[this.header]) {
              response.header(this.header, generateId())
            }
          }
        } else {
          return h.response(response).header(this.header, generateId())
        }
        break
      case 'proxy':
        if (request.headers[this.header]) {
          const correlationId = request.headers[this.header]
          if (typeof response === 'object') {
            if (response.isBoom) {
              response.output.headers[this.header] = correlationId
            } else {
              response.header(this.header, correlationId)
            }
          } else {
            return h.response(response).header(this.header, correlationId)
          }
        }
        break
      case 'all':
        if (typeof response === 'object') {
          if (response.isBoom) {
            if (!response.output.headers[this.header]) {
              response.output.headers[this.header] = internals.getOrNewCorrelationId(request.headers, this.header)
            }
          } else {
            if (!response.headers[this.header]) {
              response.header(this.header, internals.getOrNewCorrelationId(request.headers, this.header))
            }
          }
        } else {
          return h.response(response)
            .header(this.header, internals.getOrNewCorrelationId(request.headers, this.header))
        }
        break
    }
  }
  return h.continue
}

// bc
internals.correlationIdHelper = (header) => (request) => {
  let correlationId = request.headers[header]
  const result = internals.schema.correlationId.validate(correlationId)
  if (result.error) {
    correlationId = generateId()
  }
  return correlationId
}

exports.plugin = {
  pkg: require('../package.json'),
  once: true,
  register: async (server, opts) => {
    const options = Joi.attempt(opts, internals.schema.options, 'Invalid plugin options')
    server.ext('onRequest', internals.onRequest, {
      bind: {
        ...options,
        header: options.header.toLowerCase()
      }
    })
    server.ext('onPreResponse', internals.onPreResponse, {
      bind: {
        ...options,
        header: options.header.toLowerCase()
      }
    })
    server.decorate('request', 'correlationId', internals.correlationIdHelper(options.header.toLowerCase()), {
      apply: true
    })
  }
}
