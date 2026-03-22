/**
 * ขนาดและสี QR หน้า vending / เติมเงิน
 * - eyes (มุม): ดำ
 * - body (dots): แดงสด
 */
export const APP_QR_SIZE = 300
export const APP_QR_ERROR_LEVEL = 'H' as const
export const APP_QR_BACKGROUND = '#ffffff'

export const APP_QR_EYES_COLOR = '#000000'
/** แดงสด (อ่านง่ายบนพื้นขาว) */
export const APP_QR_BODY_COLOR = '#ff1744'

/** ส่งให้ QrcodeSVG color — แยกสี eyes / body */
export const APP_QR_COLOR = {
  eyes: APP_QR_EYES_COLOR,
  body: APP_QR_BODY_COLOR,
} as const
