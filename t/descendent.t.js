require('proof')(1, prove)

function prove (okay) {
    var Descendent = require('..')
    okay(Descendent, 'require')
}
