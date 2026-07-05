/**
 * Ergo explorer env helpers.
 *
 * This file exists as a narrow compatibility bridge for legacy imports that
 * expect `$lib/ergo/envs`.
 */

import { DEFAULT_EXPLORER_URI_TOKEN } from '../common/constants';

/** Default token explorer base URL used by FileCard links. */
export const web_explorer_uri_tkn = DEFAULT_EXPLORER_URI_TOKEN;


/**
 * Converts a hex string from a serialized value to a UTF-8 string.
 * @param hexString The hexadecimal string to convert.
 * @returns A UTF-8 string or null on error.
 */
export function hexToUtf8(hexString: string): string | null {
    if (!hexString || hexString.length % 2 !== 0) {
        return ""; // Return empty string for invalid input
    }
    try {
        const byteArray = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(byteArray);
    } catch (e) {
        console.error("hexToUtf8 conversion error with ", hexString, e);
        return null;
    }
}