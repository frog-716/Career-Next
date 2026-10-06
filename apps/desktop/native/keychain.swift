import Foundation
import Security
import CryptoKit

// No arbitrary query, service name, file path, or executable is accepted.
struct Input: Decodable { let action: String; let namespace: String; let slot: String; let value: String? }
struct NativeFailure: Error { let status: OSStatus }
func reply(_ value: [String:Any], _ code: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject:value)) ?? Data("{}".utf8)
    FileHandle.standardOutput.write(data); exit(code)
}
func query(_ input: Input) -> [String:Any] {
    [kSecClass as String:kSecClassGenericPassword,
     kSecAttrService as String:"dev.career.next.native-v1." + input.namespace,
     kSecAttrAccount as String:input.slot]
}
func wrappingKey(_ input: Input, create: Bool) throws -> SymmetricKey {
    var parameters=query(input);parameters[kSecReturnData as String]=true;parameters[kSecMatchLimit as String]=kSecMatchLimitOne
    var item: CFTypeRef?;let status=SecItemCopyMatching(parameters as CFDictionary,&item)
    if status == errSecSuccess, let data=item as? Data, data.count == 32 { return SymmetricKey(data:data) }
    if status != errSecItemNotFound || !create { throw NativeFailure(status:status) }
    let key=SymmetricKey(size:.bits256);let data=key.withUnsafeBytes { Data($0) }
    var attributes=query(input);attributes[kSecValueData as String]=data
    attributes[kSecAttrLabel as String]="Career local secret protection"
    attributes[kSecAttrSynchronizable as String]=false
    let added=SecItemAdd(attributes as CFDictionary,nil)
    if added == errSecDuplicateItem { return try wrappingKey(input,create:false) }
    if added != errSecSuccess { throw NativeFailure(status:added) };return key
}
do {
    let bytes=FileHandle.standardInput.readDataToEndOfFile()
    guard bytes.count <= 128*1024 else { reply(["error":"invalid_request"],1) }
    let input=try JSONDecoder().decode(Input.self,from:bytes)
    guard input.namespace.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil,
          ["deepseek","tavily"].contains(input.slot) else { reply(["error":"invalid_request"],1) }
    switch input.action {
    case "available": reply(["available":true])
    case "encrypt":
        guard let value=input.value, !value.isEmpty, value.utf8.count <= 16384 else { reply(["error":"invalid_request"],1) }
        let key=try wrappingKey(input,create:true);let sealed=try AES.GCM.seal(Data(value.utf8),using:key)
        guard let data=sealed.combined else { reply(["error":"encrypt_failed"],1) };reply(["value":data.base64EncodedString()])
    case "decrypt":
        guard let value=input.value,let data=Data(base64Encoded:value),data.count <= 65536 else { reply(["error":"invalid_request"],1) }
        let key=try wrappingKey(input,create:false);let plain=try AES.GCM.open(AES.GCM.SealedBox(combined:data),using:key)
        guard let value=String(data:plain,encoding:.utf8) else { reply(["error":"decrypt_failed"],1) };reply(["value":value])
    case "delete-test-root":
        // A local private maintenance action; never exposed through the Web bridge.
        let status=SecItemDelete(query(input) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw NativeFailure(status:status) };reply(["deleted":true])
    default: reply(["error":"invalid_request"],1)
    }
} catch let error as NativeFailure { reply(["error":"keychain_failed","osStatus":error.status],1) }
catch { reply(["error":"invalid_request"],1) }
