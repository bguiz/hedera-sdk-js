import { SingleTransactionBuilder } from "../TransactionBuilder";
import { Transaction } from "../generated/transaction_pb";
import { TransactionResponse } from "../generated/transaction_response_pb";
import { grpc } from "@improbable-eng/grpc-web";
import { ContractCreateTransactionBody } from "../generated/contract_create_pb";
import { newDuration } from "../util";
import BigNumber from "bignumber.js";
import { SmartContractService } from "../generated/smart_contract_service_pb_service";

import {
    Hbar,
    Tinybar,
    hbarFromTinybarOrHbar,
    hbarCheck,
    hbarToProto
} from "../Hbar";
import { PublicKey } from "../crypto/PublicKey";
import { FileId, FileIdLike } from "../file/FileId";
import { AccountId, AccountIdLike } from "../account/AccountId";
import { ContractFunctionParams } from "./ContractFunctionParams";

/**
 * Start a new smart contract instance. After the instance is created, the ContractID for it is
 * in the receipt, or can be retrieved with a GetByKey query, or by asking for a Record of the
 * transaction to be created, and retrieving that. The instance will run the bytecode stored in
 * the given file, referenced either by FileID or by the transaction ID of the transaction that
 * created the file. The constructor will be executed using the given amount of gas, and any
 * unspent gas will be refunded to the paying account. Constructor inputs come from the given
 * constructorParameters.
 *
 * The instance will exist for autoRenewPeriod seconds. When that is reached, it will renew
 * itself for another autoRenewPeriod seconds by charging its associated cryptocurrency account
 * (which it creates here). If it has insufficient cryptocurrency to extend that long, it will
 * extend as long as it can. If its balance is zero, the instance will be deleted.
 *
 * A smart contract instance normally enforces rules, so "the code is law". For example, an
 * ERC-20 contract prevents a transfer from being undone without a signature by the recipient
 * of the transfer. This is always enforced if the contract instance was created with the
 * adminKeys being null. But for some uses, it might be desirable to create something like an
 * ERC-20 contract that has a specific group of trusted individuals who can act as a
 * "supreme court" with the ability to override the normal operation, when a sufficient number
 * of them agree to do so. If adminKeys is not null, then they can sign a transaction that can
 * change the state of the smart contract in arbitrary ways, such as to reverse a transaction
 * that violates some standard of behavior that is not covered by the code itself. The admin
 * keys can also be used to change the autoRenewPeriod, and change the adminKeys field itself.
 * The API currently does not implement this ability. But it does allow the adminKeys field to
 * be set and queried, and will in the future implement such admin abilities for any instance
 * that has a non-null adminKeys.
 *
 * If this constructor stores information, it is charged gas to store it. There is a fee in
 * hbars to maintain that storage until the expiration time, and that fee is added as part
 * of the transaction fee.
 *
 * An entity (account, file, or smart contract instance) must be created in a particular realm.
 * If the realmID is left null, then a new realm will be created with the given admin key.
 * If a new realm has a null adminKey, then anyone can create/modify/delete entities in that realm.
 * But if an admin key is given, then any transaction to create/modify/delete an entity in that
 * realm must be signed by that key, though anyone can still call functions on smart contract
 * instances that exist in that realm. A realm ceases to exist when everything within it has
 * expired and no longer exists.
 *
 * The current API ignores shardID, realmID, and newRealmAdminKey, and creates everything in
 * shard 0 and realm 0, with a null key. Future versions of the API will support multiple
 * realms and multiple shards.
 *
 * The optional memo field can contain a string whose length is up to 100 bytes. That is the
 * size after Unicode NFD then UTF-8 conversion. This field can be used to describe the smart
 * contract. It could also be used for other purposes. One recommended purpose is to hold a
 * hexadecimal string that is the SHA-384 hash of a PDF file containing a human-readable legal
 * contract. Then, if the admin keys are the public keys of human arbitrators, they can use
 * that legal document to guide their decisions during a binding arbitration tribunal, convened
 * to consider any changes to the smart contract in the future. The memo field can only be
 * changed using the admin keys. If there are no admin keys, then it cannot be changed
 * after the smart contract is created.
 */
export class ContractCreateTransaction extends SingleTransactionBuilder {
    private readonly _body: ContractCreateTransactionBody;

    public constructor() {
        super();
        this._body = new ContractCreateTransactionBody();
        this._inner.setContractcreateinstance(this._body);

        // Default autoRenewPeriod to a value within the required range (~1/4 a year)
        this.setAutoRenewPeriod(131500 * 60);
    }

    /**
     * The file containing the smart contract byte code. A copy will be made and held by
     * the contract instance, and have the same expiration time as the instance.
     */
    public setBytecodeFileId(fileIdLike: FileIdLike): this {
        this._body.setFileid(new FileId(fileIdLike)._toProto());
        return this;
    }

    /**
     * The state of the instance and its fields can be modified arbitrarily if this
     * key signs a transaction to modify it. If this is null, then such modifications
     * are not possible, and there is no administrator that can override the normal operation
     * of this smart contract instance. Note that if it is created with no admin keys, then
     * there is no administrator to authorize changing the admin keys, so there can never be
     * any admin keys for that instance.
     */
    public setAdminKey(publicKey: PublicKey): this {
        this._body.setAdminkey(publicKey._toProtoKey());
        return this;
    }

    /**
     * Gas to run the constructor.
     */
    public setGas(gas: number | BigNumber): this {
        this._body.setGas(String(gas));
        return this;
    }

    /**
     * Initial number of tinybars to put into the cryptocurrency account associated with and owned by the smart contract.
     */
    public setInitialBalance(balance: Tinybar | Hbar): this {
        const balanceHbar = hbarFromTinybarOrHbar(balance);
        balanceHbar[ hbarCheck ]({ allowNegative: false });

        this._body.setInitialbalance(balanceHbar[ hbarToProto ]());
        return this;
    }

    /**
     * ID of the account to which this account is proxy staked. If proxyAccountID is null, or is
     *  an invalid account, or is an account that isn't a node, then this account is automatically
     * proxy staked to a node chosen by the network, but without earning payments. If the
     * proxyAccountID account refuses to accept proxy staking , or if it is not currently running
     * a node, then it will behave as if  proxyAccountID was null.
     */
    public setProxyAccountId(proxyAccountId: AccountIdLike): this {
        this._body.setProxyaccountid(new AccountId(proxyAccountId)._toProto());
        return this;
    }

    /**
     * The instance will charge its account every this many seconds to renew for this long.
     */
    public setAutoRenewPeriod(seconds: number): this {
        this._body.setAutorenewperiod(newDuration(seconds));
        return this;
    }

    /**
     * Parameters to pass to the constructor.
     */
    public setConstructorParams(constructorParams: ContractFunctionParams): this {
        this._body.setConstructorparameters(constructorParams._build(null));
        return this;
    }

    /**
     * The memo that was submitted as part of the contract (max 100 bytes).
     */
    public setContractMemo(memo: string): this {
        this._body.setMemo(memo);
        return this;
    }

    protected _doValidate(errors: string[]): void {
        if (!this._body.hasFileid()) {
            errors.push(".setBytecodeFile() required");
        }
    }

    protected get _method(): grpc.UnaryMethodDefinition<
        Transaction,
        TransactionResponse
        > {
        return SmartContractService.createContract;
    }
}
