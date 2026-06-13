// ============================================================
// AUTO-GENERATED — do not edit manually.
// Run `npm run generate:openapi` to regenerate.
// ============================================================

export const openapi = {
  "openapi": "3.0.3",
  "info": {
    "title": "Pinace API",
    "version": "0.1.0",
    "description": "REST API for Pinace Wallet — pools, agents, actions, and event logs."
  },
  "components": {
    "schemas": {}
  },
  "paths": {
    "/health": {
      "get": {
        "summary": "Service health check",
        "tags": [
          "Health"
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "enum": [
                        "ok",
                        "error"
                      ]
                    },
                    "lastCheckpoint": {
                      "type": "number",
                      "description": "Last indexed checkpoint sequence number"
                    },
                    "lagMs": {
                      "type": "number",
                      "description": "Milliseconds since last checkpoint update"
                    }
                  },
                  "required": [
                    "status",
                    "lastCheckpoint",
                    "lagMs"
                  ],
                  "additionalProperties": false
                }
              }
            }
          },
          "503": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "enum": [
                        "ok",
                        "error"
                      ]
                    },
                    "lastCheckpoint": {
                      "type": "number",
                      "description": "Last indexed checkpoint sequence number"
                    },
                    "lagMs": {
                      "type": "number",
                      "description": "Milliseconds since last checkpoint update"
                    },
                    "error": {
                      "type": "string"
                    },
                    "message": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "status",
                    "lastCheckpoint",
                    "lagMs"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/pools/{poolId}": {
      "get": {
        "summary": "Get a pool by ID",
        "tags": [
          "Pools"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "path",
            "name": "poolId",
            "required": true,
            "description": "Pool on-chain object ID"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "poolId": {
                      "type": "string"
                    },
                    "owner": {
                      "type": "string"
                    },
                    "status": {
                      "type": "string"
                    },
                    "protocolVersion": {
                      "type": "number"
                    },
                    "createdAt": {
                      "type": "string",
                      "description": "ISO 8601 timestamp"
                    },
                    "balances": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "coinType": {
                            "type": "string"
                          },
                          "amount": {
                            "type": "string"
                          }
                        },
                        "required": [
                          "coinType",
                          "amount"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "poolId",
                    "owner",
                    "status",
                    "protocolVersion",
                    "createdAt",
                    "balances"
                  ],
                  "additionalProperties": false
                }
              }
            }
          },
          "404": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string"
                    },
                    "message": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "error",
                    "message"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/agents": {
      "get": {
        "summary": "List agents with optional filters",
        "tags": [
          "Agents"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "owner",
            "required": false,
            "description": "Filter by owner address"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "poolId",
            "required": false,
            "description": "Filter by pool ID"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "status",
            "required": false,
            "description": "Filter by agent status"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "page",
            "required": false,
            "description": "Page number (default: 1)"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "limit",
            "required": false,
            "description": "Items per page (default: 20)"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "address": {
                            "type": "string",
                            "description": "On-chain agent address"
                          },
                          "poolId": {
                            "type": "string"
                          },
                          "owner": {
                            "type": "string"
                          },
                          "name": {
                            "type": "string"
                          },
                          "status": {
                            "type": "string"
                          },
                          "runStatus": {
                            "type": "string",
                            "enum": [
                              "running",
                              "done",
                              "idle"
                            ]
                          },
                          "expiresMs": {
                            "type": "number",
                            "description": "Unix epoch ms when agent key expires"
                          },
                          "connectedAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          },
                          "revokedAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          },
                          "actionCount": {
                            "type": "number"
                          },
                          "lastActiveAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          },
                          "policies": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "properties": {
                                "id": {
                                  "type": "string"
                                },
                                "policyType": {
                                  "type": "string"
                                },
                                "configHash": {
                                  "type": "string",
                                  "nullable": true
                                },
                                "marketplaceId": {
                                  "type": "string",
                                  "nullable": true
                                },
                                "status": {
                                  "type": "string"
                                },
                                "attachedAt": {
                                  "type": "number",
                                  "nullable": true,
                                  "description": "Unix epoch ms"
                                },
                                "updatedAt": {
                                  "type": "number",
                                  "nullable": true,
                                  "description": "Unix epoch ms"
                                },
                                "removedAt": {
                                  "type": "number",
                                  "nullable": true,
                                  "description": "Unix epoch ms"
                                }
                              },
                              "required": [
                                "id",
                                "policyType",
                                "configHash",
                                "marketplaceId",
                                "status",
                                "attachedAt",
                                "updatedAt",
                                "removedAt"
                              ],
                              "additionalProperties": false
                            }
                          }
                        },
                        "required": [
                          "id",
                          "address",
                          "poolId",
                          "owner",
                          "name",
                          "status",
                          "runStatus",
                          "expiresMs",
                          "connectedAt",
                          "revokedAt",
                          "actionCount",
                          "lastActiveAt"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "total": {
                      "type": "number"
                    },
                    "page": {
                      "type": "number"
                    },
                    "limit": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "data",
                    "total",
                    "page",
                    "limit"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/agents/{agentId}": {
      "get": {
        "summary": "Get a single agent with policies",
        "tags": [
          "Agents"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "path",
            "name": "agentId",
            "required": true,
            "description": "Agent database UUID"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "address": {
                      "type": "string",
                      "description": "On-chain agent address"
                    },
                    "poolId": {
                      "type": "string"
                    },
                    "owner": {
                      "type": "string"
                    },
                    "name": {
                      "type": "string"
                    },
                    "status": {
                      "type": "string"
                    },
                    "runStatus": {
                      "type": "string",
                      "enum": [
                        "running",
                        "done",
                        "idle"
                      ]
                    },
                    "expiresMs": {
                      "type": "number",
                      "description": "Unix epoch ms when agent key expires"
                    },
                    "connectedAt": {
                      "type": "number",
                      "nullable": true,
                      "description": "Unix epoch ms"
                    },
                    "revokedAt": {
                      "type": "number",
                      "nullable": true,
                      "description": "Unix epoch ms"
                    },
                    "actionCount": {
                      "type": "number"
                    },
                    "lastActiveAt": {
                      "type": "number",
                      "nullable": true,
                      "description": "Unix epoch ms"
                    },
                    "policies": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "policyType": {
                            "type": "string"
                          },
                          "configHash": {
                            "type": "string",
                            "nullable": true
                          },
                          "marketplaceId": {
                            "type": "string",
                            "nullable": true
                          },
                          "status": {
                            "type": "string"
                          },
                          "attachedAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          },
                          "updatedAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          },
                          "removedAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          }
                        },
                        "required": [
                          "id",
                          "policyType",
                          "configHash",
                          "marketplaceId",
                          "status",
                          "attachedAt",
                          "updatedAt",
                          "removedAt"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "id",
                    "address",
                    "poolId",
                    "owner",
                    "name",
                    "status",
                    "runStatus",
                    "expiresMs",
                    "connectedAt",
                    "revokedAt",
                    "actionCount",
                    "lastActiveAt"
                  ],
                  "additionalProperties": false
                }
              }
            }
          },
          "404": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string"
                    },
                    "message": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "error",
                    "message"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/agents/{agentId}/timeline": {
      "get": {
        "summary": "Get an agent's event timeline with milestones and summary stats",
        "tags": [
          "Agents"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "before",
            "required": false,
            "description": "ISO timestamp cursor for pagination"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "path",
            "name": "agentId",
            "required": true,
            "description": "Agent database UUID"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "events": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "eventType": {
                            "type": "string"
                          },
                          "poolId": {
                            "type": "string"
                          },
                          "agentAddress": {
                            "type": "string",
                            "nullable": true
                          },
                          "nonce": {
                            "type": "number",
                            "nullable": true
                          },
                          "txDigest": {
                            "type": "string"
                          },
                          "checkpointSeq": {
                            "type": "number"
                          },
                          "timestamp": {
                            "type": "string",
                            "description": "ISO 8601 timestamp"
                          },
                          "rawPayload": {},
                          "action": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string"
                              },
                              "poolId": {
                                "type": "string"
                              },
                              "agentAddress": {
                                "type": "string"
                              },
                              "nonce": {
                                "type": "number"
                              },
                              "kind": {
                                "type": "string",
                                "description": "swap | withdraw | deposit | unknown"
                              },
                              "amountIn": {
                                "type": "string",
                                "description": "Decimal string"
                              },
                              "minAmountOut": {
                                "type": "string",
                                "description": "Decimal string"
                              },
                              "quotedAmountOut": {
                                "type": "string",
                                "nullable": true,
                                "description": "Decimal string"
                              },
                              "settlementStatus": {
                                "type": "number",
                                "nullable": true,
                                "description": "1 = success, 0 = failed"
                              },
                              "status": {
                                "type": "string",
                                "description": "proposed | settled"
                              },
                              "proposedAt": {
                                "type": "number",
                                "nullable": true,
                                "description": "Unix epoch ms"
                              },
                              "settledAt": {
                                "type": "number",
                                "nullable": true,
                                "description": "Unix epoch ms"
                              }
                            },
                            "required": [
                              "id",
                              "poolId",
                              "agentAddress",
                              "nonce",
                              "kind",
                              "amountIn",
                              "minAmountOut",
                              "quotedAmountOut",
                              "settlementStatus",
                              "status",
                              "proposedAt",
                              "settledAt"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "required": [
                          "id",
                          "eventType",
                          "poolId",
                          "agentAddress",
                          "nonce",
                          "txDigest",
                          "checkpointSeq",
                          "timestamp"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "milestones": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "agentId": {
                            "type": "string"
                          },
                          "action": {
                            "type": "string",
                            "description": "kind of the underlying action"
                          },
                          "amount": {
                            "type": "string",
                            "description": "Decimal string"
                          },
                          "coinType": {
                            "type": "string"
                          },
                          "timestamp": {
                            "type": "number",
                            "description": "Unix epoch ms"
                          },
                          "status": {
                            "type": "string",
                            "enum": [
                              "success",
                              "reverted",
                              "pending"
                            ]
                          },
                          "txDigest": {
                            "type": "string"
                          }
                        },
                        "required": [
                          "id",
                          "agentId",
                          "action",
                          "amount",
                          "coinType",
                          "timestamp",
                          "status"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "summary": {
                      "type": "object",
                      "properties": {
                        "actionCount": {
                          "type": "number"
                        },
                        "successRate": {
                          "type": "number",
                          "nullable": true,
                          "description": "0–100, null if no settled actions"
                        },
                        "lastActiveAt": {
                          "type": "number",
                          "nullable": true,
                          "description": "Unix epoch ms"
                        },
                        "totalVolumeByKind": {
                          "type": "object",
                          "additionalProperties": {
                            "type": "string"
                          },
                          "description": "kind → decimal string sum"
                        }
                      },
                      "required": [
                        "actionCount",
                        "successRate",
                        "lastActiveAt",
                        "totalVolumeByKind"
                      ],
                      "additionalProperties": false
                    },
                    "hasMore": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "events",
                    "milestones",
                    "summary",
                    "hasMore"
                  ],
                  "additionalProperties": false
                }
              }
            }
          },
          "404": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string"
                    },
                    "message": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "error",
                    "message"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/actions": {
      "get": {
        "summary": "List actions with optional filters",
        "tags": [
          "Actions"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "poolId",
            "required": false,
            "description": "Filter by pool ID"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "agentAddress",
            "required": false,
            "description": "Filter by agent address"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "status",
            "required": false,
            "description": "Filter by action status"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "kind",
            "required": false,
            "description": "Filter by kind: swap | withdraw | deposit"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "page",
            "required": false,
            "description": "Page number (default: 1)"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "limit",
            "required": false,
            "description": "Items per page (default: 20, max: 100)"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "poolId": {
                            "type": "string"
                          },
                          "agentAddress": {
                            "type": "string"
                          },
                          "nonce": {
                            "type": "number"
                          },
                          "kind": {
                            "type": "string",
                            "description": "swap | withdraw | deposit | unknown"
                          },
                          "amountIn": {
                            "type": "string",
                            "description": "Decimal string"
                          },
                          "minAmountOut": {
                            "type": "string",
                            "description": "Decimal string"
                          },
                          "quotedAmountOut": {
                            "type": "string",
                            "nullable": true,
                            "description": "Decimal string"
                          },
                          "settlementStatus": {
                            "type": "number",
                            "nullable": true,
                            "description": "1 = success, 0 = failed"
                          },
                          "status": {
                            "type": "string",
                            "description": "proposed | settled"
                          },
                          "proposedAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          },
                          "settledAt": {
                            "type": "number",
                            "nullable": true,
                            "description": "Unix epoch ms"
                          }
                        },
                        "required": [
                          "id",
                          "poolId",
                          "agentAddress",
                          "nonce",
                          "kind",
                          "amountIn",
                          "minAmountOut",
                          "quotedAmountOut",
                          "settlementStatus",
                          "status",
                          "proposedAt",
                          "settledAt"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "total": {
                      "type": "number"
                    },
                    "page": {
                      "type": "number"
                    },
                    "limit": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "data",
                    "total",
                    "page",
                    "limit"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/actions/{actionId}": {
      "get": {
        "summary": "Get a single action by ID",
        "tags": [
          "Actions"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "path",
            "name": "actionId",
            "required": true,
            "description": "Action database UUID"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "poolId": {
                      "type": "string"
                    },
                    "agentAddress": {
                      "type": "string"
                    },
                    "nonce": {
                      "type": "number"
                    },
                    "kind": {
                      "type": "string",
                      "description": "swap | withdraw | deposit | unknown"
                    },
                    "amountIn": {
                      "type": "string",
                      "description": "Decimal string"
                    },
                    "minAmountOut": {
                      "type": "string",
                      "description": "Decimal string"
                    },
                    "quotedAmountOut": {
                      "type": "string",
                      "nullable": true,
                      "description": "Decimal string"
                    },
                    "settlementStatus": {
                      "type": "number",
                      "nullable": true,
                      "description": "1 = success, 0 = failed"
                    },
                    "status": {
                      "type": "string",
                      "description": "proposed | settled"
                    },
                    "proposedAt": {
                      "type": "number",
                      "nullable": true,
                      "description": "Unix epoch ms"
                    },
                    "settledAt": {
                      "type": "number",
                      "nullable": true,
                      "description": "Unix epoch ms"
                    }
                  },
                  "required": [
                    "id",
                    "poolId",
                    "agentAddress",
                    "nonce",
                    "kind",
                    "amountIn",
                    "minAmountOut",
                    "quotedAmountOut",
                    "settlementStatus",
                    "status",
                    "proposedAt",
                    "settledAt"
                  ],
                  "additionalProperties": false
                }
              }
            }
          },
          "404": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string"
                    },
                    "message": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "error",
                    "message"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    },
    "/events": {
      "get": {
        "summary": "List event logs with optional filters",
        "tags": [
          "Events"
        ],
        "parameters": [
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "poolId",
            "required": false,
            "description": "Filter by pool ID"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "agentAddress",
            "required": false,
            "description": "Filter by agent address"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "eventType",
            "required": false,
            "description": "Filter by event type"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "page",
            "required": false,
            "description": "Page number (default: 1)"
          },
          {
            "schema": {
              "type": "string"
            },
            "in": "query",
            "name": "limit",
            "required": false,
            "description": "Items per page (default: 50, max: 200)"
          }
        ],
        "responses": {
          "200": {
            "description": "Default Response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "eventType": {
                            "type": "string"
                          },
                          "poolId": {
                            "type": "string"
                          },
                          "agentAddress": {
                            "type": "string",
                            "nullable": true
                          },
                          "nonce": {
                            "type": "number",
                            "nullable": true
                          },
                          "txDigest": {
                            "type": "string"
                          },
                          "checkpointSeq": {
                            "type": "number"
                          },
                          "timestamp": {
                            "type": "string",
                            "description": "ISO 8601 timestamp"
                          },
                          "rawPayload": {},
                          "action": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string"
                              },
                              "poolId": {
                                "type": "string"
                              },
                              "agentAddress": {
                                "type": "string"
                              },
                              "nonce": {
                                "type": "number"
                              },
                              "kind": {
                                "type": "string",
                                "description": "swap | withdraw | deposit | unknown"
                              },
                              "amountIn": {
                                "type": "string",
                                "description": "Decimal string"
                              },
                              "minAmountOut": {
                                "type": "string",
                                "description": "Decimal string"
                              },
                              "quotedAmountOut": {
                                "type": "string",
                                "nullable": true,
                                "description": "Decimal string"
                              },
                              "settlementStatus": {
                                "type": "number",
                                "nullable": true,
                                "description": "1 = success, 0 = failed"
                              },
                              "status": {
                                "type": "string",
                                "description": "proposed | settled"
                              },
                              "proposedAt": {
                                "type": "number",
                                "nullable": true,
                                "description": "Unix epoch ms"
                              },
                              "settledAt": {
                                "type": "number",
                                "nullable": true,
                                "description": "Unix epoch ms"
                              }
                            },
                            "required": [
                              "id",
                              "poolId",
                              "agentAddress",
                              "nonce",
                              "kind",
                              "amountIn",
                              "minAmountOut",
                              "quotedAmountOut",
                              "settlementStatus",
                              "status",
                              "proposedAt",
                              "settledAt"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "required": [
                          "id",
                          "eventType",
                          "poolId",
                          "agentAddress",
                          "nonce",
                          "txDigest",
                          "checkpointSeq",
                          "timestamp"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "total": {
                      "type": "number"
                    },
                    "page": {
                      "type": "number"
                    },
                    "limit": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "data",
                    "total",
                    "page",
                    "limit"
                  ],
                  "additionalProperties": false
                }
              }
            }
          }
        }
      }
    }
  },
  "tags": [
    {
      "name": "Health",
      "description": "Service health and indexer lag"
    },
    {
      "name": "Pools",
      "description": "Liquidity pool data"
    },
    {
      "name": "Agents",
      "description": "Agent accounts and policies"
    },
    {
      "name": "Actions",
      "description": "Agent-initiated on-chain actions"
    },
    {
      "name": "Events",
      "description": "Raw on-chain event logs"
    }
  ]
} as const;

export type OpenAPISpec = typeof openapi;
