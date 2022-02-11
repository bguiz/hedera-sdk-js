import AccountId from "../account/AccountId.js";
import Timestamp from "../Timestamp.js";
import * as proto from "@hashgraph/proto";
import Long from "long";

/**
 * The client-generated ID for a transaction.
 *
 * This is used for retrieving receipts and records for a transaction, for appending to a file
 * right after creating it, for instantiating a smart contract with bytecode in a file just created,
 * and internally by the network for detecting when duplicate transactions are submitted.
 */
export default class ForeignTransactionData {
    /**
     * @param {?Uint8Array} foreignTransactionBytes
     * @param {?number} payloadStart
     * @param {?number} payloadLength
     * @param {?Long | number} nonce
     */
    constructor(foreignTransactionBytes, payloadStart, payloadLength, nonce = null) {
        /**
         * The Account ID that paid for this transaction.
         *
         * @readonly
         */
        this.foreignTransactionBytes = foreignTransactionBytes;

        /**
         * The time from when this transaction is valid.
         *
         * When a transaction is submitted there is additionally a validDuration (defaults to 120s)
         * and together they define a time window that a transaction may be processed in.
         *
         * @readonly
         */
        this.payloadStart = payloadStart;

        this.payloadLength = payloadLength;

        this.nonce = null;
        if (nonce != null && nonce != 0) {
            this.setNonce(nonce);
        }

        Object.freeze(this);
    }

    /**
     * @param {Long | number} nonce
     * @returns {TransactionId}
     */
    setNonce(nonce) {
        this.nonce = typeof nonce === "number" ? Long.fromNumber(nonce) : nonce;
        return this;
    }

    /**
     * @param {AccountId} accountId
     * @param {Timestamp} validStart
     * @returns {TransactionId}
     */
    static withValidStart(accountId, validStart) {
        return new TransactionId(accountId, validStart, null);
    }

    /**
     * Generates a new transaction ID for the given account ID.
     *
     * Note that transaction IDs are made of the valid start of the transaction and the account
     * that will be charged the transaction fees for the transaction.
     *
     * @param {AccountId | string} id
     * @returns {TransactionId}
     */
    static generate(id) {
        return new TransactionId(
            typeof id === "string"
                ? AccountId.fromString(id)
                : new AccountId(id),
            Timestamp.generate()
        );
    }

    /**
     * @param {string} wholeId
     * @returns {TransactionId}
     */
    static fromString(wholeId) {
        let account, seconds, nanos, isScheduled, nonce;
        let rest;
        // 1.1.1@5.4?scheduled/117

        [account, rest] = wholeId.split("@");
        [seconds, rest] = rest.split(".");
        if (rest.includes("?")) {
            [nanos, rest] = rest.split("?scheduled");
            isScheduled = true;
            if (rest.includes("/")) {
                nonce = rest.replace("/", "");
            } else {
                nonce = null;
            }
        } else if (rest.includes("/")) {
            [nanos, nonce] = rest.split("/");
            isScheduled = false;
        } else {
            nanos = rest;
        }

        return new TransactionId(
            AccountId.fromString(account),
            new Timestamp(Long.fromValue(seconds), Long.fromValue(nanos)),
            isScheduled,
            nonce != null ? Long.fromString(nonce) : null
        );
    }

    /**
     * @param {boolean} scheduled
     * @returns {this}
     */
    setScheduled(scheduled) {
        this.scheduled = scheduled;
        return this;
    }

    /**
     * @returns {string}
     */
    toString() {
        if (this.accountId != null && this.validStart != null) {
            const nonce =
                this.nonce != null ? "/".concat(this.nonce.toString()) : "";
            const scheduled = this.scheduled ? "?scheduled" : "";
            return `${this.accountId.toString()}@${this.validStart.seconds.toString()}.${this.validStart.nanos.toString()}${scheduled}${nonce}`;
        } else {
            throw new Error("neither `accountId` nor `validStart` are set");
        }
    }

    /**
     * @internal
     * @param {proto.ITransactionID} id
     * @returns {TransactionId}
     */
    static _fromProtobuf(id) {
        if (id.accountID != null && id.transactionValidStart != null) {
            return new TransactionId(
                AccountId._fromProtobuf(id.accountID),
                Timestamp._fromProtobuf(id.transactionValidStart),
                id.scheduled,
                id.nonce
            );
        } else {
            throw new Error(
                "Neither `nonce` or `accountID` and `transactionValidStart` are set"
            );
        }
    }

    /**
     * @internal
     * @returns {proto.ITransactionID}
     */
    _toProtobuf() {
        return {
            accountID:
                this.accountId != null ? this.accountId._toProtobuf() : null,
            transactionValidStart:
                this.validStart != null ? this.validStart._toProtobuf() : null,
            scheduled: this.scheduled,
            nonce: this.nonce != null ? this.nonce.toInt() : null,
        };
    }

    /**
     * @param {Uint8Array} bytes
     * @returns {TransactionId}
     */
    static fromBytes(bytes) {
        return TransactionId._fromProtobuf(proto.TransactionID.decode(bytes));
    }

    /**
     * @returns {Uint8Array}
     */
    toBytes() {
        return proto.TransactionID.encode(this._toProtobuf()).finish();
    }

    /**
     * @returns {TransactionId}
     */
    clone() {
        return new TransactionId(
            this.accountId,
            this.validStart,
            this.scheduled,
            this.nonce
        );
    }

    /**
     * @param {TransactionId} other
     * @returns {number}
     */
    compare(other) {
        const comparison = /** @type {AccountId} */ (this.accountId).compare(
            /** @type {AccountId} */ (other.accountId)
        );

        if (comparison != 0) {
            return comparison;
        }

        return /** @type {Timestamp} */ (this.validStart).compare(
            /** @type {Timestamp} */ (other.validStart)
        );
    }
}