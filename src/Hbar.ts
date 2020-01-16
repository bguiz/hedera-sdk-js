import BigNumber from "bignumber.js";
import { HbarRangeError } from "./errors";
import { UInt64Value } from "google-protobuf/google/protobuf/wrappers_pb";

export type Tinybar = number;

export class HbarUnit {
    public static readonly Tinybar = new HbarUnit("tinybar");
    public static readonly Microbar = new HbarUnit("microbar");
    public static readonly Millibar = new HbarUnit("millibar");
    public static readonly Hbar = new HbarUnit("hbar");
    public static readonly Kilobar = new HbarUnit("kilobar");
    public static readonly Megabar = new HbarUnit("megabar");
    public static readonly Gigabar = new HbarUnit("gigabar");

    private readonly _unit: string;

    private constructor(unit: string) {
        this._unit = unit;
    }

    public getSymbol(): string {
        switch (this._unit) {
            case "tinybar": return "tℏ";
            case "microbar": return "μℏ";
            case "millibar": return "mℏ";
            case "hbar": return "ℏ";
            case "kilobar": return "kℏ";
            case "megabar": return "Mℏ";
            case "gigabar": return "Gℏ";
            default: throw new TypeError("HbarUnit was not a valid value");
        }
    }

    public _toTinybarCount(): BigNumber {
        switch (this._unit) {
            case "tinybar": return new BigNumber(1);
            case "microbar": return new BigNumber(100);
            case "millibar": return new BigNumber(100_000);
            case "hbar": return new BigNumber(100_000_000);
            case "kilobar": return new BigNumber(100_000_000).multipliedBy(1000);
            case "megabar": return new BigNumber(100_000_000).multipliedBy(1_000_000);
            case "gigabar": return new BigNumber(100_000_000).multipliedBy(1_000_000_000);
            default: throw new TypeError("HbarUnit was not a valid value");
        }
    }

    public toString(): string {
        return this._unit;
    }
}

function convertToTinybar(amount: BigNumber.Value, unit: HbarUnit): BigNumber {
    const bnAmount = BigNumber.isBigNumber(amount) ? amount : new BigNumber(amount);
    return bnAmount.multipliedBy(unit._toTinybarCount());
}

const maxTinybar = new BigNumber(2).pow(63).minus(1);
const maxHbar = maxTinybar.dividedBy(HbarUnit.Hbar._toTinybarCount());

const minTinybar = new BigNumber(-2).pow(63);
const minHbar = minTinybar.dividedBy(HbarUnit.Hbar._toTinybarCount());

/**
 * Typesafe wrapper for values of HBAR providing foolproof conversions to other denominations.
 */
export class Hbar {
    /** The HBAR value in tinybar, used natively by the SDK and Hedera itself */
    private readonly _tinybar: BigNumber;
    private readonly _unit: HbarUnit;

    public constructor(amount: number | BigNumber | string) {
        const bnAmount = amount instanceof BigNumber ? amount : new BigNumber(amount);
        this._tinybar = bnAmount.multipliedBy(HbarUnit.Hbar._toTinybarCount());
        this._unit = HbarUnit.Hbar;
        this._check(true);
    }

    public static readonly MAX: Hbar = new Hbar(maxHbar);

    public static readonly MIN: Hbar = new Hbar(minHbar);

    public static readonly ZERO: Hbar = Hbar.zero();

    /**
     * Calculate the HBAR amount given a raw value and a unit.
     */
    public static from(amount: number | BigNumber | string, unit: HbarUnit): Hbar {
        const bnAmount = amount instanceof BigNumber ? amount : new BigNumber(amount);
        const tinybar = bnAmount.multipliedBy(unit._toTinybarCount());
        const hbar = tinybar.dividedBy(HbarUnit.Hbar._toTinybarCount());
        return new Hbar(hbar);
    }

    /** Get HBAR from a tinybar amount, may be a string */
    public static fromTinybar(amount: number | BigNumber | string): Hbar {
        if (typeof amount === "number" && amount >= 2 ** 53) {
            throw new HbarRangeError(new Hbar(amount));
        }

        const bnAmount = amount instanceof BigNumber ? amount : new BigNumber(amount);
        return new Hbar(bnAmount.dividedBy(HbarUnit.Hbar._toTinybarCount()));
    }

    /**
     * Wrap a raw value of HBAR, may be a string.
     * @deprecate Use constructor instead. `new Hbar(amount)`
     */
    public static of(amount: number | BigNumber | string): Hbar {
        console.warn("`Hbar.of` is deprecated. Use `new Hbar(amount)` instead.");
        return new Hbar(amount);
    }

    /** Create an Hbar with a value of 0 tinybar; Note that this is a positive signed zero */
    public static zero(): Hbar {
        return new Hbar(new BigNumber(0));
    }

    public toString(): string {
        return this._unit === HbarUnit.Tinybar ?
            `${this.value()} ${this._unit.toString()}` :
            `${this.value()} ${this._unit.toString()} (${this._tinybar.toString(10)} tinybar)`;
    }

    public value(): BigNumber {
        return this.as(HbarUnit.Hbar);
    }

    public asTinybar(): BigNumber {
        return this.as(HbarUnit.Tinybar);
    }

    public as(unit: HbarUnit): BigNumber {
        if (unit.toString() === "tinybar") {
            return this._tinybar;
        }

        return this._tinybar.dividedBy(unit._toTinybarCount());
    }

    public multipliedBy(amount: number | BigNumber): Hbar {
        return new Hbar(this._tinybar.multipliedBy(amount));
    }

    public plus(hbar: Hbar): Hbar;
    public plus(amount: number | BigNumber, unit: HbarUnit): Hbar;
    public plus(amount: Hbar | number | BigNumber, unit?: HbarUnit): Hbar {
        return new Hbar((amount instanceof Hbar ?
            this._tinybar.plus(amount._tinybar) :
            this._tinybar.plus(convertToTinybar(amount, unit!))
        ).dividedBy(HbarUnit.Hbar._toTinybarCount()));
    }

    public minus(hbar: Hbar): Hbar;
    public minus(amount: number | BigNumber, unit: HbarUnit): Hbar;
    public minus(amount: Hbar | number | BigNumber, unit?: HbarUnit): Hbar {
        return new Hbar((amount instanceof Hbar ?
            this._tinybar.minus(amount._tinybar) :
            this._tinybar.minus(convertToTinybar(amount, unit!))
        ).dividedBy(HbarUnit.Hbar._toTinybarCount()));
    }

    public isEqualTo(hbar: Hbar): boolean;
    public isEqualTo(amount: number | BigNumber, unit: HbarUnit): boolean;
    public isEqualTo(amount: Hbar | number | BigNumber, unit?: HbarUnit): boolean {
        return amount instanceof Hbar ?
            this._tinybar.isEqualTo(amount._tinybar) :
            this._tinybar.isEqualTo(convertToTinybar(amount, unit!));
    }

    public isGreaterThan(hbar: Hbar): boolean;
    public isGreaterThan(amount: number | BigNumber, unit: HbarUnit): boolean;
    public isGreaterThan(amount: Hbar | number | BigNumber, unit?: HbarUnit): boolean {
        return amount instanceof Hbar ?
            this._tinybar.isGreaterThan(amount._tinybar) :
            this._tinybar.isGreaterThan(convertToTinybar(amount, unit!));
    }

    public isGreaterThanOrEqualTo(hbar: Hbar): boolean;
    public isGreaterThanOrEqualTo(amount: number | BigNumber, unit: HbarUnit): boolean;
    public isGreaterThanOrEqualTo(amount: Hbar | number | BigNumber, unit?: HbarUnit): boolean {
        return amount instanceof Hbar ?
            this._tinybar.isGreaterThanOrEqualTo(amount._tinybar) :
            this._tinybar.isGreaterThanOrEqualTo(convertToTinybar(amount, unit!));
    }

    public isLessThan(hbar: Hbar): boolean;
    public isLessThan(amount: number | BigNumber, unit: HbarUnit): boolean;
    public isLessThan(amount: Hbar | number | BigNumber, unit?: HbarUnit): boolean {
        return amount instanceof Hbar ?
            this._tinybar.isLessThan(amount._tinybar) :
            this._tinybar.isLessThan(convertToTinybar(amount, unit!));
    }

    public isLessThanOrEqualTo(hbar: Hbar): boolean;
    public isLessThanOrEqualTo(amount: number | BigNumber, unit: HbarUnit): boolean;
    public isLessThanOrEqualTo(amount: Hbar | number | BigNumber, unit?: HbarUnit): boolean {
        return amount instanceof Hbar ?
            this._tinybar.isLessThanOrEqualTo(amount._tinybar) :
            this._tinybar.isLessThanOrEqualTo(convertToTinybar(amount, unit!));
    }

    public comparedTo(hbar: Hbar): number;
    public comparedTo(amount: number | BigNumber, unit: HbarUnit): number;
    public comparedTo(amount: Hbar | number | BigNumber, unit?: HbarUnit): number {
        return amount instanceof Hbar ?
            this._tinybar.comparedTo(amount._tinybar) :
            this._tinybar.comparedTo(convertToTinybar(amount, unit!));
    }

    public isZero(): boolean {
        return this._tinybar.isZero();
    }

    public negated(): Hbar {
        return new Hbar(this._tinybar.negated().dividedBy(HbarUnit.Hbar._toTinybarCount()));
    }

    public isNegative(): boolean {
        return this._tinybar.isNegative();
    }

    public isPositive(): boolean {
        return this._tinybar.isPositive();
    }

    // NOT A STABLE API
    public _check(allowNegative = false): void {
        if (this._tinybar.isNegative() && !allowNegative && this._tinybar.isLessThan(maxTinybar)) {
            throw new HbarRangeError(this);
        }

        if (this._tinybar.isGreaterThan(maxTinybar)) {
            throw new HbarRangeError(this);
        }
    }

    // NOT A STABLE API
    public _toProto(): string {
        return String(this._tinybar);
    }

    // NOT A STABLE API
    public _toProtoValue(): UInt64Value {
        const value = new UInt64Value();
        value.setValue(this._tinybar.toNumber());
        return value;
    }
}
