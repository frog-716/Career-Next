import Foundation
import Darwin
// This launcher owns only the short startup lock. The backend owns the SQLite writer lock.
let arguments=Array(CommandLine.arguments.dropFirst())
let profileArgument=arguments.first { $0.hasPrefix("--user-data-dir=") }
let profile=profileArgument.map { String($0.dropFirst("--user-data-dir=".count)) } ?? NSHomeDirectory()+"/Library/Application Support/Career Next"
let fileManager=FileManager.default
let executable=URL(fileURLWithPath:CommandLine.arguments[0]).resolvingSymlinksInPath()
let resources=executable.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Resources")
let packaged=fileManager.fileExists(atPath:resources.appendingPathComponent("runtime/node").path)
let root=packaged ? resources.appendingPathComponent("application") : executable.deletingLastPathComponent()
let node=packaged ? resources.appendingPathComponent("runtime/node") : root.appendingPathComponent("../../node_modules/node/bin/node").standardized
try fileManager.createDirectory(atPath:profile,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
let lock=open(profile+"/.launcher.lock",O_CREAT|O_RDWR|O_NOFOLLOW,0o600)
guard lock >= 0,flock(lock,LOCK_EX) == 0 else { exit(1) }
defer { flock(lock,LOCK_UN); close(lock) }
let task=Process();task.executableURL=node;task.arguments=[root.appendingPathComponent("node-launcher.cjs").path]+arguments
var environment=["PATH":"/usr/bin:/bin","HOME":NSHomeDirectory(),"CAREER_LAUNCH_LOCKED":"1"]
task.environment=environment;try task.run();task.waitUntilExit();exit(task.terminationStatus)
