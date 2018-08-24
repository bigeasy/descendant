process.stdin.resume()

process.on('message', function (message, handle) {
    handle.write('y')
})

var net = require('net')
var socket = new net.Socket({ fd: 3 })

socket.on('data', function (data) { console.log(data.toString()) })
