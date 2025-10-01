// utils/statusCodes.js

const StatusCodes = {
  SUCCESS: {
    code: 200,
    message: "Success",
  },
  CREATED: {
    code: 201,
    message: "Resource created successfully",
  },
  BAD_REQUEST: {
    code: 400,
    message: "Bad request",
  },
  UNAUTHORIZED: {
    code: 401,
    message: "Unauthorized",
  },
  FORBIDDEN: {
    code: 403,
    message: "Forbidden",
  },
  NOT_FOUND: {
    code: 404,
    message: "Not found",
  },
  CONFLICT: {
    code: 409,
    message: "Conflict",
  },
  SERVER_ERROR: {
    code: 500,
    message: "Internal server error",
  },
};

export default StatusCodes;
