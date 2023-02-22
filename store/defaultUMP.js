/** The default secret server.
 * @private
*/
export const DEFAULT_SECRET_SERVER = 'https://secretserver.babbage.systems'

/** The default Dojo UTXO management server.
 * @private
*/
export const DEFAULT_DOJO_URL = 'https://dojo.babbage.systems'

/** The default BHRP resolvers.
 * @private
*/
export const DEFAULT_CONFEDERACY_HOST = [
  'https://confederacy.babbage.systems'
]

/**
 * The number of seconds that the kernel will keep the privileged key available without prompting for a password, after which the decrypted copy of the privileged key will be destroyed.
 * @private
*/
export const DEFAULT_PRIVILEGED_KEY_TIMEOUT = 120

/**
 * A generous and approximate overhead needed to spend the new outputs that are created when funding a user account with more BSV tokens. Given that the Dojo server has 6 minimum desired P2RPH UTXOs on hand, we approximate the fee needed to spend at most 6 new outputs. We are generous to account for changes in miner fee rates over time.
 * @private
*/
export const DEFAULT_APPROX_TRANSACTION_OVERHEAD = 1500

export default {
  DEFAULT_APPROX_TRANSACTION_OVERHEAD,
  DEFAULT_PRIVILEGED_KEY_TIMEOUT,
  DEFAULT_DOJO_URL,
  DEFAULT_SECRET_SERVER
}