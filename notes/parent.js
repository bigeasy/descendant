var children = require('child_process')
var path = require('path')

var child = children.spawn('node', [ path.join(__dirname, 'child.js') ], {
    stdio: [ 'inherit', 'inherit', 'inherit', 'pipe' ]
})

child.on('close', function () { console.log('did close') })

setTimeout(function () { child.kill() }, 1000)
setTimeout(function () {}, 2000)
