/**
 * Custom error class for Hyperliquid API errors.
 */
export class HyperliquidAPIError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'HyperliquidAPIError';
        Object.setPrototypeOf(this, HyperliquidAPIError.prototype);
    }
}

/**
 * Handles API errors and throws a HyperliquidAPIError with appropriate details.
 * @param error - The error object received from the API call.
 * @throws {HyperliquidAPIError}
 */
export function handleApiError(error: any): never {
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new HyperliquidAPIError(
            error.response.data?.code || 'UNKNOWN_ERROR',
            error.response.data?.message || 'An unknown error occurred'
        );
    } else if (error.request) {
        // The request was made but no response was received
        throw new HyperliquidAPIError('NETWORK_ERROR', 'No response received from the server');
    } else {
        // Something happened in setting up the request that triggered an Error
        throw new HyperliquidAPIError('REQUEST_SETUP_ERROR', error.message || 'Error setting up the request');
    }
}
