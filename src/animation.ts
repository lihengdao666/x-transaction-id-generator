import type { GenerateAnimationKeyOptions } from "./types.js";

const TOTAL_TIME = 4096;

function isOdd(num: number): number {
  return num % 2 ? -1.0 : 0.0;
}

function solve(value: number, minVal: number, maxVal: number, rounding: boolean): number {
  const result = (value * (maxVal - minVal)) / 255 + minVal;
  return rounding ? Math.floor(result) : Number(result.toFixed(2));
}

function floatToHex(x: number): string {
  const result: string[] = [];
  let quotient = Math.floor(x);
  const fraction = x - quotient;

  while (quotient > 0) {
    quotient = Math.floor(x / 16);
    const remainder = Math.floor(x - quotient * 16);
    result.unshift(remainder > 9 ? String.fromCharCode(remainder + 55) : String(remainder));
    x = quotient;
  }

  if (fraction === 0) return result.join("");

  result.push(".");
  let current = fraction;
  while (current > 0) {
    current *= 16;
    const integer = Math.floor(current);
    current -= integer;
    result.push(integer > 9 ? String.fromCharCode(integer + 55) : String(integer));
  }
  return result.join("");
}

function interpolate(fromList: number[], toList: number[], value: number): number[] {
  return fromList.map((from, index) => from * (1 - value) + toList[index] * value);
}

function convertRotationToMatrix(rotation: number): number[] {
  const rad = (rotation * Math.PI) / 180;
  return [Math.cos(rad), -Math.sin(rad), Math.sin(rad), Math.cos(rad)];
}

class Cubic {
  public constructor(
    private readonly curves: number[],
    private readonly epsilon = 0.000001,
  ) {}

  private calculate(a: number, b: number, m: number): number {
    const c = 3.0 * a;
    const bCoeff = 3.0 * (b - a) - c;
    const aCoeff = 1.0 - c - bCoeff;
    return ((aCoeff * m + bCoeff) * m + c) * m;
  }

  public getValue(time: number): number {
    let startGradient = 0;
    let endGradient = 0;
    let start = 0.0;
    let mid = 0.0;
    let end = 1.0;

    if (time <= 0.0) {
      if (this.curves[0] > 0.0) {
        startGradient = this.curves[1] / this.curves[0];
      } else if (this.curves[1] === 0.0 && this.curves[2] > 0.0) {
        startGradient = this.curves[3] / this.curves[2];
      }
      return startGradient * time;
    }

    if (time >= 1.0) {
      if (this.curves[2] < 1.0) {
        endGradient = (this.curves[3] - 1.0) / (this.curves[2] - 1.0);
      } else if (this.curves[2] === 1.0 && this.curves[0] < 1.0) {
        endGradient = (this.curves[1] - 1.0) / (this.curves[0] - 1.0);
      }
      return 1.0 + endGradient * (time - 1.0);
    }

    while (start < end) {
      mid = (start + end) / 2;
      const xEst = this.calculate(this.curves[0], this.curves[2], mid);
      if (Math.abs(time - xEst) < this.epsilon) {
        return this.calculate(this.curves[1], this.curves[3], mid);
      }
      if (xEst < time) {
        start = mid;
      } else {
        end = mid;
      }
    }
    return this.calculate(this.curves[1], this.curves[3], mid);
  }
}

/**
 * Split one SVG path into numeric animation rows.
 * 将单个 SVG path 拆分为数值动画行。
 */
function parseFrameRows(frame: string): number[][] {
  return frame
    .substring(9)
    .split("C")
    .map((item) => {
      const cleaned = item.replace(/[^\d]+/g, " ").trim();
      return cleaned === "" ? [] : cleaned.split(/\s+/).map(Number);
    });
}

/**
 * Calculate the animation fingerprint for one selected row.
 * 根据选中的动画行计算动画指纹。
 */
function animateFrame(row: number[], targetTime: number, epsilon: number): string {
  const fromColor = row.slice(0, 3).concat(1).map(Number);
  const toColor = row.slice(3, 6).concat(1).map(Number);
  const fromRotation = [0.0];
  const toRotation = [solve(row[6], 60.0, 360.0, true)];
  const curves = row.slice(7).map((item, counter) => solve(item, isOdd(counter), 1.0, false));

  const value = new Cubic(curves, epsilon).getValue(targetTime);
  const color = interpolate(fromColor, toColor, value).map((item) => Math.min(255, Math.max(0, item)));
  const rotation = interpolate(fromRotation, toRotation, value);
  const matrix = convertRotationToMatrix(rotation[0]);

  const parts = color.slice(0, -1).map((item) => Math.round(item).toString(16));
  for (const item of matrix) {
    const rounded = Math.abs(Number(item.toFixed(2)));
    const hexValue = floatToHex(rounded);
    parts.push(hexValue.startsWith(".") ? `0${hexValue}`.toLowerCase() : hexValue || "0");
  }
  parts.push("0", "0");
  return parts.join("").replace(/[.-]/g, "");
}

/**
 * Derive the deterministic animation key from site key bytes, SVG frames, and ondemand indices.
 * 根据站点 key 字节、SVG 动画帧和 ondemand 索引推导确定性的 animation key。
 */
export function generateAnimationKey(
  key: string,
  frames: string[],
  indices: number[],
  options: GenerateAnimationKeyOptions = {},
): string {
  const keyBytes = Buffer.from(key, "base64");
  const epsilon = options.epsilon ?? 0.000001;

  if (!Array.isArray(frames) || frames.length < 4) {
    throw new TypeError("frames must contain at least four loading animation paths");
  }
  if (!Array.isArray(indices) || indices.length < 4) {
    throw new TypeError("indices must contain at least four ondemand byte indices");
  }

  const rowIndex = keyBytes[indices[0]] % 16;
  let frameTime = indices.slice(1).reduce((acc, index) => acc * (keyBytes[index] % 16), 1);
  frameTime = Math.round(frameTime / 10) * 10;

  const frame = frames[keyBytes[5] % frames.length];
  const row = parseFrameRows(frame)[rowIndex];
  if (!row) {
    throw new Error(`animation frame row ${rowIndex} not found`);
  }

  return animateFrame(row, frameTime / TOTAL_TIME, epsilon);
}
