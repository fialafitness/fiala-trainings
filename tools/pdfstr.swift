import Foundation
import PDFKit
let args = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: args[1]))!
var out = ""
for p in 0..<doc.pageCount { if let page = doc.page(at: p), let s = page.string { out += "\n=== PAGE \(p + 1) ===\n" + s + "\n" } }
try! out.write(toFile: args[2], atomically: true, encoding: .utf8)
print("pages:", doc.pageCount)
