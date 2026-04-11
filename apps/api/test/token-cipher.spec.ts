import { ConfigService } from "@nestjs/config";
import { TokenCipherService } from "../src/common/crypto/token-cipher.service";

describe("TokenCipherService", () => {
  it("encrypts and decrypts a token", () => {
    const service = new TokenCipherService(
      new ConfigService({
        tokenEncryptionKey: "12345678901234567890123456789012"
      })
    );

    const encrypted = service.encrypt("secret-token");
    expect(encrypted).not.toEqual("secret-token");
    expect(service.decrypt(encrypted)).toEqual("secret-token");
  });
});
