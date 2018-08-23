process.stdin.resume()
process.stdin.on('close', function () { console.log('did close') })

var net = require('net')

var socket = new net.Socket({ fd: 3 })

socket.on('data', function () {})
socket.on('end', function () { console.log('ended') })
socket.on('close', function () { console.log('closed') })
process.on('disconnect', function () { console.log('disconnected') })
process.on('beforeExit', function () { console.log('beforeExit') })

console.log('did make socket')
