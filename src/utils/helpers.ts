import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { handleApiError } from './errors';
import { RateLimiter } from './rateLimiter';

/**
 * HttpApi class for making API requests with rate limiting.
 */
export class HttpApi {
    private client: AxiosInstance;
    private endpoint: string;
    private rateLimiter: RateLimiter;

    /**
     * @param baseUrl - The base URL for the API.
     * @param endpoint - The default endpoint for requests.
     * @param rateLimiter - The rate limiter instance.
     */
    constructor(baseUrl: string, endpoint: string = '/', rateLimiter: RateLimiter) {
        this.endpoint = endpoint;
        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.rateLimiter = rateLimiter;
    }

    /**
     * Make a POST request to the API.
     * @param payload - The request payload.
     * @param weight - The weight of the request for rate limiting.
     * @param endpoint - The endpoint for this specific request (overrides default).
     * @returns Promise resolving to the API response data.
     * @throws {HyperliquidAPIError}
     */
    async makeRequest(payload: any, weight: number = 2, endpoint: string = this.endpoint): Promise<any> {
        try {
            await this.rateLimiter.waitForToken(weight);
            const response = await this.client.post(endpoint, payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    }

    /**
     * Make a GET request to the API.
     * @param endpoint - The endpoint for this specific request.
     * @param config - Optional Axios request configuration.
     * @returns Promise resolving to the API response data.
     * @throws {HyperliquidAPIError}
     */
    async get(endpoint: string, config?: AxiosRequestConfig): Promise<any> {
        try {
            await this.rateLimiter.waitForToken(1); // Assuming GET requests have a weight of 1
            const response = await this.client.get(endpoint, config);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    }
}
