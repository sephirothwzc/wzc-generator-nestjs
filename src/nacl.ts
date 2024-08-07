import nacl, { BoxKeyPair } from 'tweetnacl'

class NaCl {
  private _keyBox: BoxKeyPair
  private readonly nonceLength = 24

  constructor() {
    this._keyBox = nacl.box.keyPair()
  }

  private newNonce() {
    return nacl.randomBytes(this.nonceLength)
  }

  private encodeUTF8(s: string) {
    s = encodeURI(encodeURIComponent(s))
    const result = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      if ((c & 0xff) !== c) throw { message: 'Cannot encode string in Latin1', str: s }
      result[i] = c & 0xff
    }
    return result
  }

  private to_hex(bs: Uint8Array) {
    const encoded = [] as string[]
    for (let i = 0; i < bs.length; i++) {
      encoded.push('0123456789abcdef'[(bs[i] >> 4) & 15])
      encoded.push('0123456789abcdef'[bs[i] & 15])
    }
    return encoded.join('')
  }

  private from_hex(s: string) {
    const result = new Uint8Array(s.length / 2)
    for (let i = 0; i < s.length / 2; i++) {
      result[i] = parseInt(s.substr(2 * i, 2), 16)
    }
    return result
  }
  /**
   * 加密
   * @param text 明文字符串
   * @param publicKey 公钥
   */
  public async encrypt(text: string, publicKey: string) {
    try {
      const nonce = this.newNonce()
      const message = this.encodeUTF8(text)
      const key = nacl.box.before(this.from_hex(publicKey), this._keyBox.secretKey)
      const encrypted = nacl.box.after(message, nonce, key)
      const fullUint8 = new Uint8Array(nonce.length + this._keyBox.publicKey.length + encrypted.length)
      fullUint8.set(nonce)
      fullUint8.set(this._keyBox.publicKey, nonce.length)
      fullUint8.set(encrypted, nonce.length + this._keyBox.publicKey.length)
      // 24位nonce + 32位本地公钥匙 + 加密串
      return this.to_hex(fullUint8)
    } catch (error) {
      return Promise.reject(error)
    }
  }
}

export default new NaCl()
