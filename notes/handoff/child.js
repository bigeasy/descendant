process.stdin.resume()
process.stdin.on('close', function () { console.log('did close') })

var net = require('net')

process.on('disconnect', function () { console.log('disconnected') })
process.on('beforeExit', function () { console.log('beforeExit') })

console.log('did make socket')

process.on('message', function (message, handle) { handle.write('y') })
