/* aesjs start*/

"use strict";

function checkInt(value) {
  return (parseInt(value) === value);
}

function checkInts(arrayish) {
  if (!checkInt(arrayish.length)) { return false; }

  for (var i = 0; i < arrayish.length; i++) {
    if (!checkInt(arrayish[i]) || arrayish[i] < 0 || arrayish[i] > 255) {
      return false;
    }
  }

  return true;
}

function coerceArray(arg, copy) {

  // ArrayBuffer view
  if (arg.buffer && ArrayBuffer.isView(arg) && arg.name === 'Uint8Array') {

    if (copy) {
      if (arg.slice) {
        arg = arg.slice();
      } else {
        arg = Array.prototype.slice.call(arg);
      }
    }

    return arg;
  }

  // It's an array; check it is a valid representation of a byte
  if (Array.isArray(arg)) {
    if (!checkInts(arg)) {
      throw new Error('Array contains invalid value: ' + arg);
    }

    return new Uint8Array(arg);
  }

  // Something else, but behaves like an array (maybe a Buffer? Arguments?)
  if (checkInt(arg.length) && checkInts(arg)) {
    return new Uint8Array(arg);
  }

  throw new Error('unsupported array-like object');
}

function createArray(length) {
  return new Uint8Array(length);
}

function copyArray(sourceArray, targetArray, targetStart, sourceStart, sourceEnd) {
  if (sourceStart != null || sourceEnd != null) {
    if (sourceArray.slice) {
      sourceArray = sourceArray.slice(sourceStart, sourceEnd);
    } else {
      sourceArray = Array.prototype.slice.call(sourceArray, sourceStart, sourceEnd);
    }
  }
  targetArray.set(sourceArray, targetStart);
}



var convertUtf8 = (function () {
  function toBytes(text) {
    var result = [], i = 0;
    text = encodeURI(text);
    while (i < text.length) {
      var c = text.charCodeAt(i++);

      // if it is a % sign, encode the following 2 bytes as a hex value
      if (c === 37) {
        result.push(parseInt(text.substr(i, 2), 16))
        i += 2;

        // otherwise, just the actual byte
      } else {
        result.push(c)
      }
    }

    return coerceArray(result);
  }

  function fromBytes(bytes) {
    var result = [], i = 0;

    while (i < bytes.length) {
      var c = bytes[i];

      if (c < 128) {
        result.push(String.fromCharCode(c));
        i++;
      } else if (c > 191 && c < 224) {
        result.push(String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
        i += 2;
      } else {
        result.push(String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
        i += 3;
      }
    }

    return result.join('');
  }

  return {
    toBytes: toBytes,
    fromBytes: fromBytes,
  }
})();

var convertHex = (function () {
  function toBytes(text) {
    var result = [];
    for (var i = 0; i < text.length; i += 2) {
      result.push(parseInt(text.substr(i, 2), 16));
    }

    return result;
  }

  var Hex = '0123456789abcdef';

  function fromBytes(bytes) {
    var result = [];
    for (var i = 0; i < bytes.length; i++) {
      var v = bytes[i];
      result.push(Hex[(v & 0xf0) >> 4] + Hex[v & 0x0f]);
    }
    return result.join('');
  }

  return {
    toBytes: toBytes,
    fromBytes: fromBytes,
  }
})();


// Number of rounds by keysize
var numberOfRounds = { 16: 10, 24: 12, 32: 14 }

// Round constant words
var rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91];

// S-box and Inverse S-box (S is for Substitution)
var S = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16];
var Si = [0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb, 0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb, 0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e, 0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25, 0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92, 0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84, 0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06, 0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b, 0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73, 0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e, 0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b, 0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4, 0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f, 0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef, 0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61, 0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d];

// Transformations for encryption
var T1 = [0xc66363a5, 0xf87c7c84, 0xee777799, 0xf67b7b8d, 0xfff2f20d, 0xd66b6bbd, 0xde6f6fb1, 0x91c5c554, 0x60303050, 0x02010103, 0xce6767a9, 0x562b2b7d, 0xe7fefe19, 0xb5d7d762, 0x4dababe6, 0xec76769a, 0x8fcaca45, 0x1f82829d, 0x89c9c940, 0xfa7d7d87, 0xeffafa15, 0xb25959eb, 0x8e4747c9, 0xfbf0f00b, 0x41adadec, 0xb3d4d467, 0x5fa2a2fd, 0x45afafea, 0x239c9cbf, 0x53a4a4f7, 0xe4727296, 0x9bc0c05b, 0x75b7b7c2, 0xe1fdfd1c, 0x3d9393ae, 0x4c26266a, 0x6c36365a, 0x7e3f3f41, 0xf5f7f702, 0x83cccc4f, 0x6834345c, 0x51a5a5f4, 0xd1e5e534, 0xf9f1f108, 0xe2717193, 0xabd8d873, 0x62313153, 0x2a15153f, 0x0804040c, 0x95c7c752, 0x46232365, 0x9dc3c35e, 0x30181828, 0x379696a1, 0x0a05050f, 0x2f9a9ab5, 0x0e070709, 0x24121236, 0x1b80809b, 0xdfe2e23d, 0xcdebeb26, 0x4e272769, 0x7fb2b2cd, 0xea75759f, 0x1209091b, 0x1d83839e, 0x582c2c74, 0x341a1a2e, 0x361b1b2d, 0xdc6e6eb2, 0xb45a5aee, 0x5ba0a0fb, 0xa45252f6, 0x763b3b4d, 0xb7d6d661, 0x7db3b3ce, 0x5229297b, 0xdde3e33e, 0x5e2f2f71, 0x13848497, 0xa65353f5, 0xb9d1d168, 0x00000000, 0xc1eded2c, 0x40202060, 0xe3fcfc1f, 0x79b1b1c8, 0xb65b5bed, 0xd46a6abe, 0x8dcbcb46, 0x67bebed9, 0x7239394b, 0x944a4ade, 0x984c4cd4, 0xb05858e8, 0x85cfcf4a, 0xbbd0d06b, 0xc5efef2a, 0x4faaaae5, 0xedfbfb16, 0x864343c5, 0x9a4d4dd7, 0x66333355, 0x11858594, 0x8a4545cf, 0xe9f9f910, 0x04020206, 0xfe7f7f81, 0xa05050f0, 0x783c3c44, 0x259f9fba, 0x4ba8a8e3, 0xa25151f3, 0x5da3a3fe, 0x804040c0, 0x058f8f8a, 0x3f9292ad, 0x219d9dbc, 0x70383848, 0xf1f5f504, 0x63bcbcdf, 0x77b6b6c1, 0xafdada75, 0x42212163, 0x20101030, 0xe5ffff1a, 0xfdf3f30e, 0xbfd2d26d, 0x81cdcd4c, 0x180c0c14, 0x26131335, 0xc3ecec2f, 0xbe5f5fe1, 0x359797a2, 0x884444cc, 0x2e171739, 0x93c4c457, 0x55a7a7f2, 0xfc7e7e82, 0x7a3d3d47, 0xc86464ac, 0xba5d5de7, 0x3219192b, 0xe6737395, 0xc06060a0, 0x19818198, 0x9e4f4fd1, 0xa3dcdc7f, 0x44222266, 0x542a2a7e, 0x3b9090ab, 0x0b888883, 0x8c4646ca, 0xc7eeee29, 0x6bb8b8d3, 0x2814143c, 0xa7dede79, 0xbc5e5ee2, 0x160b0b1d, 0xaddbdb76, 0xdbe0e03b, 0x64323256, 0x743a3a4e, 0x140a0a1e, 0x924949db, 0x0c06060a, 0x4824246c, 0xb85c5ce4, 0x9fc2c25d, 0xbdd3d36e, 0x43acacef, 0xc46262a6, 0x399191a8, 0x319595a4, 0xd3e4e437, 0xf279798b, 0xd5e7e732, 0x8bc8c843, 0x6e373759, 0xda6d6db7, 0x018d8d8c, 0xb1d5d564, 0x9c4e4ed2, 0x49a9a9e0, 0xd86c6cb4, 0xac5656fa, 0xf3f4f407, 0xcfeaea25, 0xca6565af, 0xf47a7a8e, 0x47aeaee9, 0x10080818, 0x6fbabad5, 0xf0787888, 0x4a25256f, 0x5c2e2e72, 0x381c1c24, 0x57a6a6f1, 0x73b4b4c7, 0x97c6c651, 0xcbe8e823, 0xa1dddd7c, 0xe874749c, 0x3e1f1f21, 0x964b4bdd, 0x61bdbddc, 0x0d8b8b86, 0x0f8a8a85, 0xe0707090, 0x7c3e3e42, 0x71b5b5c4, 0xcc6666aa, 0x904848d8, 0x06030305, 0xf7f6f601, 0x1c0e0e12, 0xc26161a3, 0x6a35355f, 0xae5757f9, 0x69b9b9d0, 0x17868691, 0x99c1c158, 0x3a1d1d27, 0x279e9eb9, 0xd9e1e138, 0xebf8f813, 0x2b9898b3, 0x22111133, 0xd26969bb, 0xa9d9d970, 0x078e8e89, 0x339494a7, 0x2d9b9bb6, 0x3c1e1e22, 0x15878792, 0xc9e9e920, 0x87cece49, 0xaa5555ff, 0x50282878, 0xa5dfdf7a, 0x038c8c8f, 0x59a1a1f8, 0x09898980, 0x1a0d0d17, 0x65bfbfda, 0xd7e6e631, 0x844242c6, 0xd06868b8, 0x824141c3, 0x299999b0, 0x5a2d2d77, 0x1e0f0f11, 0x7bb0b0cb, 0xa85454fc, 0x6dbbbbd6, 0x2c16163a];
var T2 = [0xa5c66363, 0x84f87c7c, 0x99ee7777, 0x8df67b7b, 0x0dfff2f2, 0xbdd66b6b, 0xb1de6f6f, 0x5491c5c5, 0x50603030, 0x03020101, 0xa9ce6767, 0x7d562b2b, 0x19e7fefe, 0x62b5d7d7, 0xe64dabab, 0x9aec7676, 0x458fcaca, 0x9d1f8282, 0x4089c9c9, 0x87fa7d7d, 0x15effafa, 0xebb25959, 0xc98e4747, 0x0bfbf0f0, 0xec41adad, 0x67b3d4d4, 0xfd5fa2a2, 0xea45afaf, 0xbf239c9c, 0xf753a4a4, 0x96e47272, 0x5b9bc0c0, 0xc275b7b7, 0x1ce1fdfd, 0xae3d9393, 0x6a4c2626, 0x5a6c3636, 0x417e3f3f, 0x02f5f7f7, 0x4f83cccc, 0x5c683434, 0xf451a5a5, 0x34d1e5e5, 0x08f9f1f1, 0x93e27171, 0x73abd8d8, 0x53623131, 0x3f2a1515, 0x0c080404, 0x5295c7c7, 0x65462323, 0x5e9dc3c3, 0x28301818, 0xa1379696, 0x0f0a0505, 0xb52f9a9a, 0x090e0707, 0x36241212, 0x9b1b8080, 0x3ddfe2e2, 0x26cdebeb, 0x694e2727, 0xcd7fb2b2, 0x9fea7575, 0x1b120909, 0x9e1d8383, 0x74582c2c, 0x2e341a1a, 0x2d361b1b, 0xb2dc6e6e, 0xeeb45a5a, 0xfb5ba0a0, 0xf6a45252, 0x4d763b3b, 0x61b7d6d6, 0xce7db3b3, 0x7b522929, 0x3edde3e3, 0x715e2f2f, 0x97138484, 0xf5a65353, 0x68b9d1d1, 0x00000000, 0x2cc1eded, 0x60402020, 0x1fe3fcfc, 0xc879b1b1, 0xedb65b5b, 0xbed46a6a, 0x468dcbcb, 0xd967bebe, 0x4b723939, 0xde944a4a, 0xd4984c4c, 0xe8b05858, 0x4a85cfcf, 0x6bbbd0d0, 0x2ac5efef, 0xe54faaaa, 0x16edfbfb, 0xc5864343, 0xd79a4d4d, 0x55663333, 0x94118585, 0xcf8a4545, 0x10e9f9f9, 0x06040202, 0x81fe7f7f, 0xf0a05050, 0x44783c3c, 0xba259f9f, 0xe34ba8a8, 0xf3a25151, 0xfe5da3a3, 0xc0804040, 0x8a058f8f, 0xad3f9292, 0xbc219d9d, 0x48703838, 0x04f1f5f5, 0xdf63bcbc, 0xc177b6b6, 0x75afdada, 0x63422121, 0x30201010, 0x1ae5ffff, 0x0efdf3f3, 0x6dbfd2d2, 0x4c81cdcd, 0x14180c0c, 0x35261313, 0x2fc3ecec, 0xe1be5f5f, 0xa2359797, 0xcc884444, 0x392e1717, 0x5793c4c4, 0xf255a7a7, 0x82fc7e7e, 0x477a3d3d, 0xacc86464, 0xe7ba5d5d, 0x2b321919, 0x95e67373, 0xa0c06060, 0x98198181, 0xd19e4f4f, 0x7fa3dcdc, 0x66442222, 0x7e542a2a, 0xab3b9090, 0x830b8888, 0xca8c4646, 0x29c7eeee, 0xd36bb8b8, 0x3c281414, 0x79a7dede, 0xe2bc5e5e, 0x1d160b0b, 0x76addbdb, 0x3bdbe0e0, 0x56643232, 0x4e743a3a, 0x1e140a0a, 0xdb924949, 0x0a0c0606, 0x6c482424, 0xe4b85c5c, 0x5d9fc2c2, 0x6ebdd3d3, 0xef43acac, 0xa6c46262, 0xa8399191, 0xa4319595, 0x37d3e4e4, 0x8bf27979, 0x32d5e7e7, 0x438bc8c8, 0x596e3737, 0xb7da6d6d, 0x8c018d8d, 0x64b1d5d5, 0xd29c4e4e, 0xe049a9a9, 0xb4d86c6c, 0xfaac5656, 0x07f3f4f4, 0x25cfeaea, 0xafca6565, 0x8ef47a7a, 0xe947aeae, 0x18100808, 0xd56fbaba, 0x88f07878, 0x6f4a2525, 0x725c2e2e, 0x24381c1c, 0xf157a6a6, 0xc773b4b4, 0x5197c6c6, 0x23cbe8e8, 0x7ca1dddd, 0x9ce87474, 0x213e1f1f, 0xdd964b4b, 0xdc61bdbd, 0x860d8b8b, 0x850f8a8a, 0x90e07070, 0x427c3e3e, 0xc471b5b5, 0xaacc6666, 0xd8904848, 0x05060303, 0x01f7f6f6, 0x121c0e0e, 0xa3c26161, 0x5f6a3535, 0xf9ae5757, 0xd069b9b9, 0x91178686, 0x5899c1c1, 0x273a1d1d, 0xb9279e9e, 0x38d9e1e1, 0x13ebf8f8, 0xb32b9898, 0x33221111, 0xbbd26969, 0x70a9d9d9, 0x89078e8e, 0xa7339494, 0xb62d9b9b, 0x223c1e1e, 0x92158787, 0x20c9e9e9, 0x4987cece, 0xffaa5555, 0x78502828, 0x7aa5dfdf, 0x8f038c8c, 0xf859a1a1, 0x80098989, 0x171a0d0d, 0xda65bfbf, 0x31d7e6e6, 0xc6844242, 0xb8d06868, 0xc3824141, 0xb0299999, 0x775a2d2d, 0x111e0f0f, 0xcb7bb0b0, 0xfca85454, 0xd66dbbbb, 0x3a2c1616];
var T3 = [0x63a5c663, 0x7c84f87c, 0x7799ee77, 0x7b8df67b, 0xf20dfff2, 0x6bbdd66b, 0x6fb1de6f, 0xc55491c5, 0x30506030, 0x01030201, 0x67a9ce67, 0x2b7d562b, 0xfe19e7fe, 0xd762b5d7, 0xabe64dab, 0x769aec76, 0xca458fca, 0x829d1f82, 0xc94089c9, 0x7d87fa7d, 0xfa15effa, 0x59ebb259, 0x47c98e47, 0xf00bfbf0, 0xadec41ad, 0xd467b3d4, 0xa2fd5fa2, 0xafea45af, 0x9cbf239c, 0xa4f753a4, 0x7296e472, 0xc05b9bc0, 0xb7c275b7, 0xfd1ce1fd, 0x93ae3d93, 0x266a4c26, 0x365a6c36, 0x3f417e3f, 0xf702f5f7, 0xcc4f83cc, 0x345c6834, 0xa5f451a5, 0xe534d1e5, 0xf108f9f1, 0x7193e271, 0xd873abd8, 0x31536231, 0x153f2a15, 0x040c0804, 0xc75295c7, 0x23654623, 0xc35e9dc3, 0x18283018, 0x96a13796, 0x050f0a05, 0x9ab52f9a, 0x07090e07, 0x12362412, 0x809b1b80, 0xe23ddfe2, 0xeb26cdeb, 0x27694e27, 0xb2cd7fb2, 0x759fea75, 0x091b1209, 0x839e1d83, 0x2c74582c, 0x1a2e341a, 0x1b2d361b, 0x6eb2dc6e, 0x5aeeb45a, 0xa0fb5ba0, 0x52f6a452, 0x3b4d763b, 0xd661b7d6, 0xb3ce7db3, 0x297b5229, 0xe33edde3, 0x2f715e2f, 0x84971384, 0x53f5a653, 0xd168b9d1, 0x00000000, 0xed2cc1ed, 0x20604020, 0xfc1fe3fc, 0xb1c879b1, 0x5bedb65b, 0x6abed46a, 0xcb468dcb, 0xbed967be, 0x394b7239, 0x4ade944a, 0x4cd4984c, 0x58e8b058, 0xcf4a85cf, 0xd06bbbd0, 0xef2ac5ef, 0xaae54faa, 0xfb16edfb, 0x43c58643, 0x4dd79a4d, 0x33556633, 0x85941185, 0x45cf8a45, 0xf910e9f9, 0x02060402, 0x7f81fe7f, 0x50f0a050, 0x3c44783c, 0x9fba259f, 0xa8e34ba8, 0x51f3a251, 0xa3fe5da3, 0x40c08040, 0x8f8a058f, 0x92ad3f92, 0x9dbc219d, 0x38487038, 0xf504f1f5, 0xbcdf63bc, 0xb6c177b6, 0xda75afda, 0x21634221, 0x10302010, 0xff1ae5ff, 0xf30efdf3, 0xd26dbfd2, 0xcd4c81cd, 0x0c14180c, 0x13352613, 0xec2fc3ec, 0x5fe1be5f, 0x97a23597, 0x44cc8844, 0x17392e17, 0xc45793c4, 0xa7f255a7, 0x7e82fc7e, 0x3d477a3d, 0x64acc864, 0x5de7ba5d, 0x192b3219, 0x7395e673, 0x60a0c060, 0x81981981, 0x4fd19e4f, 0xdc7fa3dc, 0x22664422, 0x2a7e542a, 0x90ab3b90, 0x88830b88, 0x46ca8c46, 0xee29c7ee, 0xb8d36bb8, 0x143c2814, 0xde79a7de, 0x5ee2bc5e, 0x0b1d160b, 0xdb76addb, 0xe03bdbe0, 0x32566432, 0x3a4e743a, 0x0a1e140a, 0x49db9249, 0x060a0c06, 0x246c4824, 0x5ce4b85c, 0xc25d9fc2, 0xd36ebdd3, 0xacef43ac, 0x62a6c462, 0x91a83991, 0x95a43195, 0xe437d3e4, 0x798bf279, 0xe732d5e7, 0xc8438bc8, 0x37596e37, 0x6db7da6d, 0x8d8c018d, 0xd564b1d5, 0x4ed29c4e, 0xa9e049a9, 0x6cb4d86c, 0x56faac56, 0xf407f3f4, 0xea25cfea, 0x65afca65, 0x7a8ef47a, 0xaee947ae, 0x08181008, 0xbad56fba, 0x7888f078, 0x256f4a25, 0x2e725c2e, 0x1c24381c, 0xa6f157a6, 0xb4c773b4, 0xc65197c6, 0xe823cbe8, 0xdd7ca1dd, 0x749ce874, 0x1f213e1f, 0x4bdd964b, 0xbddc61bd, 0x8b860d8b, 0x8a850f8a, 0x7090e070, 0x3e427c3e, 0xb5c471b5, 0x66aacc66, 0x48d89048, 0x03050603, 0xf601f7f6, 0x0e121c0e, 0x61a3c261, 0x355f6a35, 0x57f9ae57, 0xb9d069b9, 0x86911786, 0xc15899c1, 0x1d273a1d, 0x9eb9279e, 0xe138d9e1, 0xf813ebf8, 0x98b32b98, 0x11332211, 0x69bbd269, 0xd970a9d9, 0x8e89078e, 0x94a73394, 0x9bb62d9b, 0x1e223c1e, 0x87921587, 0xe920c9e9, 0xce4987ce, 0x55ffaa55, 0x28785028, 0xdf7aa5df, 0x8c8f038c, 0xa1f859a1, 0x89800989, 0x0d171a0d, 0xbfda65bf, 0xe631d7e6, 0x42c68442, 0x68b8d068, 0x41c38241, 0x99b02999, 0x2d775a2d, 0x0f111e0f, 0xb0cb7bb0, 0x54fca854, 0xbbd66dbb, 0x163a2c16];
var T4 = [0x6363a5c6, 0x7c7c84f8, 0x777799ee, 0x7b7b8df6, 0xf2f20dff, 0x6b6bbdd6, 0x6f6fb1de, 0xc5c55491, 0x30305060, 0x01010302, 0x6767a9ce, 0x2b2b7d56, 0xfefe19e7, 0xd7d762b5, 0xababe64d, 0x76769aec, 0xcaca458f, 0x82829d1f, 0xc9c94089, 0x7d7d87fa, 0xfafa15ef, 0x5959ebb2, 0x4747c98e, 0xf0f00bfb, 0xadadec41, 0xd4d467b3, 0xa2a2fd5f, 0xafafea45, 0x9c9cbf23, 0xa4a4f753, 0x727296e4, 0xc0c05b9b, 0xb7b7c275, 0xfdfd1ce1, 0x9393ae3d, 0x26266a4c, 0x36365a6c, 0x3f3f417e, 0xf7f702f5, 0xcccc4f83, 0x34345c68, 0xa5a5f451, 0xe5e534d1, 0xf1f108f9, 0x717193e2, 0xd8d873ab, 0x31315362, 0x15153f2a, 0x04040c08, 0xc7c75295, 0x23236546, 0xc3c35e9d, 0x18182830, 0x9696a137, 0x05050f0a, 0x9a9ab52f, 0x0707090e, 0x12123624, 0x80809b1b, 0xe2e23ddf, 0xebeb26cd, 0x2727694e, 0xb2b2cd7f, 0x75759fea, 0x09091b12, 0x83839e1d, 0x2c2c7458, 0x1a1a2e34, 0x1b1b2d36, 0x6e6eb2dc, 0x5a5aeeb4, 0xa0a0fb5b, 0x5252f6a4, 0x3b3b4d76, 0xd6d661b7, 0xb3b3ce7d, 0x29297b52, 0xe3e33edd, 0x2f2f715e, 0x84849713, 0x5353f5a6, 0xd1d168b9, 0x00000000, 0xeded2cc1, 0x20206040, 0xfcfc1fe3, 0xb1b1c879, 0x5b5bedb6, 0x6a6abed4, 0xcbcb468d, 0xbebed967, 0x39394b72, 0x4a4ade94, 0x4c4cd498, 0x5858e8b0, 0xcfcf4a85, 0xd0d06bbb, 0xefef2ac5, 0xaaaae54f, 0xfbfb16ed, 0x4343c586, 0x4d4dd79a, 0x33335566, 0x85859411, 0x4545cf8a, 0xf9f910e9, 0x02020604, 0x7f7f81fe, 0x5050f0a0, 0x3c3c4478, 0x9f9fba25, 0xa8a8e34b, 0x5151f3a2, 0xa3a3fe5d, 0x4040c080, 0x8f8f8a05, 0x9292ad3f, 0x9d9dbc21, 0x38384870, 0xf5f504f1, 0xbcbcdf63, 0xb6b6c177, 0xdada75af, 0x21216342, 0x10103020, 0xffff1ae5, 0xf3f30efd, 0xd2d26dbf, 0xcdcd4c81, 0x0c0c1418, 0x13133526, 0xecec2fc3, 0x5f5fe1be, 0x9797a235, 0x4444cc88, 0x1717392e, 0xc4c45793, 0xa7a7f255, 0x7e7e82fc, 0x3d3d477a, 0x6464acc8, 0x5d5de7ba, 0x19192b32, 0x737395e6, 0x6060a0c0, 0x81819819, 0x4f4fd19e, 0xdcdc7fa3, 0x22226644, 0x2a2a7e54, 0x9090ab3b, 0x8888830b, 0x4646ca8c, 0xeeee29c7, 0xb8b8d36b, 0x14143c28, 0xdede79a7, 0x5e5ee2bc, 0x0b0b1d16, 0xdbdb76ad, 0xe0e03bdb, 0x32325664, 0x3a3a4e74, 0x0a0a1e14, 0x4949db92, 0x06060a0c, 0x24246c48, 0x5c5ce4b8, 0xc2c25d9f, 0xd3d36ebd, 0xacacef43, 0x6262a6c4, 0x9191a839, 0x9595a431, 0xe4e437d3, 0x79798bf2, 0xe7e732d5, 0xc8c8438b, 0x3737596e, 0x6d6db7da, 0x8d8d8c01, 0xd5d564b1, 0x4e4ed29c, 0xa9a9e049, 0x6c6cb4d8, 0x5656faac, 0xf4f407f3, 0xeaea25cf, 0x6565afca, 0x7a7a8ef4, 0xaeaee947, 0x08081810, 0xbabad56f, 0x787888f0, 0x25256f4a, 0x2e2e725c, 0x1c1c2438, 0xa6a6f157, 0xb4b4c773, 0xc6c65197, 0xe8e823cb, 0xdddd7ca1, 0x74749ce8, 0x1f1f213e, 0x4b4bdd96, 0xbdbddc61, 0x8b8b860d, 0x8a8a850f, 0x707090e0, 0x3e3e427c, 0xb5b5c471, 0x6666aacc, 0x4848d890, 0x03030506, 0xf6f601f7, 0x0e0e121c, 0x6161a3c2, 0x35355f6a, 0x5757f9ae, 0xb9b9d069, 0x86869117, 0xc1c15899, 0x1d1d273a, 0x9e9eb927, 0xe1e138d9, 0xf8f813eb, 0x9898b32b, 0x11113322, 0x6969bbd2, 0xd9d970a9, 0x8e8e8907, 0x9494a733, 0x9b9bb62d, 0x1e1e223c, 0x87879215, 0xe9e920c9, 0xcece4987, 0x5555ffaa, 0x28287850, 0xdfdf7aa5, 0x8c8c8f03, 0xa1a1f859, 0x89898009, 0x0d0d171a, 0xbfbfda65, 0xe6e631d7, 0x4242c684, 0x6868b8d0, 0x4141c382, 0x9999b029, 0x2d2d775a, 0x0f0f111e, 0xb0b0cb7b, 0x5454fca8, 0xbbbbd66d, 0x16163a2c];

// Transformations for decryption
var T5 = [0x51f4a750, 0x7e416553, 0x1a17a4c3, 0x3a275e96, 0x3bab6bcb, 0x1f9d45f1, 0xacfa58ab, 0x4be30393, 0x2030fa55, 0xad766df6, 0x88cc7691, 0xf5024c25, 0x4fe5d7fc, 0xc52acbd7, 0x26354480, 0xb562a38f, 0xdeb15a49, 0x25ba1b67, 0x45ea0e98, 0x5dfec0e1, 0xc32f7502, 0x814cf012, 0x8d4697a3, 0x6bd3f9c6, 0x038f5fe7, 0x15929c95, 0xbf6d7aeb, 0x955259da, 0xd4be832d, 0x587421d3, 0x49e06929, 0x8ec9c844, 0x75c2896a, 0xf48e7978, 0x99583e6b, 0x27b971dd, 0xbee14fb6, 0xf088ad17, 0xc920ac66, 0x7dce3ab4, 0x63df4a18, 0xe51a3182, 0x97513360, 0x62537f45, 0xb16477e0, 0xbb6bae84, 0xfe81a01c, 0xf9082b94, 0x70486858, 0x8f45fd19, 0x94de6c87, 0x527bf8b7, 0xab73d323, 0x724b02e2, 0xe31f8f57, 0x6655ab2a, 0xb2eb2807, 0x2fb5c203, 0x86c57b9a, 0xd33708a5, 0x302887f2, 0x23bfa5b2, 0x02036aba, 0xed16825c, 0x8acf1c2b, 0xa779b492, 0xf307f2f0, 0x4e69e2a1, 0x65daf4cd, 0x0605bed5, 0xd134621f, 0xc4a6fe8a, 0x342e539d, 0xa2f355a0, 0x058ae132, 0xa4f6eb75, 0x0b83ec39, 0x4060efaa, 0x5e719f06, 0xbd6e1051, 0x3e218af9, 0x96dd063d, 0xdd3e05ae, 0x4de6bd46, 0x91548db5, 0x71c45d05, 0x0406d46f, 0x605015ff, 0x1998fb24, 0xd6bde997, 0x894043cc, 0x67d99e77, 0xb0e842bd, 0x07898b88, 0xe7195b38, 0x79c8eedb, 0xa17c0a47, 0x7c420fe9, 0xf8841ec9, 0x00000000, 0x09808683, 0x322bed48, 0x1e1170ac, 0x6c5a724e, 0xfd0efffb, 0x0f853856, 0x3daed51e, 0x362d3927, 0x0a0fd964, 0x685ca621, 0x9b5b54d1, 0x24362e3a, 0x0c0a67b1, 0x9357e70f, 0xb4ee96d2, 0x1b9b919e, 0x80c0c54f, 0x61dc20a2, 0x5a774b69, 0x1c121a16, 0xe293ba0a, 0xc0a02ae5, 0x3c22e043, 0x121b171d, 0x0e090d0b, 0xf28bc7ad, 0x2db6a8b9, 0x141ea9c8, 0x57f11985, 0xaf75074c, 0xee99ddbb, 0xa37f60fd, 0xf701269f, 0x5c72f5bc, 0x44663bc5, 0x5bfb7e34, 0x8b432976, 0xcb23c6dc, 0xb6edfc68, 0xb8e4f163, 0xd731dcca, 0x42638510, 0x13972240, 0x84c61120, 0x854a247d, 0xd2bb3df8, 0xaef93211, 0xc729a16d, 0x1d9e2f4b, 0xdcb230f3, 0x0d8652ec, 0x77c1e3d0, 0x2bb3166c, 0xa970b999, 0x119448fa, 0x47e96422, 0xa8fc8cc4, 0xa0f03f1a, 0x567d2cd8, 0x223390ef, 0x87494ec7, 0xd938d1c1, 0x8ccaa2fe, 0x98d40b36, 0xa6f581cf, 0xa57ade28, 0xdab78e26, 0x3fadbfa4, 0x2c3a9de4, 0x5078920d, 0x6a5fcc9b, 0x547e4662, 0xf68d13c2, 0x90d8b8e8, 0x2e39f75e, 0x82c3aff5, 0x9f5d80be, 0x69d0937c, 0x6fd52da9, 0xcf2512b3, 0xc8ac993b, 0x10187da7, 0xe89c636e, 0xdb3bbb7b, 0xcd267809, 0x6e5918f4, 0xec9ab701, 0x834f9aa8, 0xe6956e65, 0xaaffe67e, 0x21bccf08, 0xef15e8e6, 0xbae79bd9, 0x4a6f36ce, 0xea9f09d4, 0x29b07cd6, 0x31a4b2af, 0x2a3f2331, 0xc6a59430, 0x35a266c0, 0x744ebc37, 0xfc82caa6, 0xe090d0b0, 0x33a7d815, 0xf104984a, 0x41ecdaf7, 0x7fcd500e, 0x1791f62f, 0x764dd68d, 0x43efb04d, 0xccaa4d54, 0xe49604df, 0x9ed1b5e3, 0x4c6a881b, 0xc12c1fb8, 0x4665517f, 0x9d5eea04, 0x018c355d, 0xfa877473, 0xfb0b412e, 0xb3671d5a, 0x92dbd252, 0xe9105633, 0x6dd64713, 0x9ad7618c, 0x37a10c7a, 0x59f8148e, 0xeb133c89, 0xcea927ee, 0xb761c935, 0xe11ce5ed, 0x7a47b13c, 0x9cd2df59, 0x55f2733f, 0x1814ce79, 0x73c737bf, 0x53f7cdea, 0x5ffdaa5b, 0xdf3d6f14, 0x7844db86, 0xcaaff381, 0xb968c43e, 0x3824342c, 0xc2a3405f, 0x161dc372, 0xbce2250c, 0x283c498b, 0xff0d9541, 0x39a80171, 0x080cb3de, 0xd8b4e49c, 0x6456c190, 0x7bcb8461, 0xd532b670, 0x486c5c74, 0xd0b85742];
var T6 = [0x5051f4a7, 0x537e4165, 0xc31a17a4, 0x963a275e, 0xcb3bab6b, 0xf11f9d45, 0xabacfa58, 0x934be303, 0x552030fa, 0xf6ad766d, 0x9188cc76, 0x25f5024c, 0xfc4fe5d7, 0xd7c52acb, 0x80263544, 0x8fb562a3, 0x49deb15a, 0x6725ba1b, 0x9845ea0e, 0xe15dfec0, 0x02c32f75, 0x12814cf0, 0xa38d4697, 0xc66bd3f9, 0xe7038f5f, 0x9515929c, 0xebbf6d7a, 0xda955259, 0x2dd4be83, 0xd3587421, 0x2949e069, 0x448ec9c8, 0x6a75c289, 0x78f48e79, 0x6b99583e, 0xdd27b971, 0xb6bee14f, 0x17f088ad, 0x66c920ac, 0xb47dce3a, 0x1863df4a, 0x82e51a31, 0x60975133, 0x4562537f, 0xe0b16477, 0x84bb6bae, 0x1cfe81a0, 0x94f9082b, 0x58704868, 0x198f45fd, 0x8794de6c, 0xb7527bf8, 0x23ab73d3, 0xe2724b02, 0x57e31f8f, 0x2a6655ab, 0x07b2eb28, 0x032fb5c2, 0x9a86c57b, 0xa5d33708, 0xf2302887, 0xb223bfa5, 0xba02036a, 0x5ced1682, 0x2b8acf1c, 0x92a779b4, 0xf0f307f2, 0xa14e69e2, 0xcd65daf4, 0xd50605be, 0x1fd13462, 0x8ac4a6fe, 0x9d342e53, 0xa0a2f355, 0x32058ae1, 0x75a4f6eb, 0x390b83ec, 0xaa4060ef, 0x065e719f, 0x51bd6e10, 0xf93e218a, 0x3d96dd06, 0xaedd3e05, 0x464de6bd, 0xb591548d, 0x0571c45d, 0x6f0406d4, 0xff605015, 0x241998fb, 0x97d6bde9, 0xcc894043, 0x7767d99e, 0xbdb0e842, 0x8807898b, 0x38e7195b, 0xdb79c8ee, 0x47a17c0a, 0xe97c420f, 0xc9f8841e, 0x00000000, 0x83098086, 0x48322bed, 0xac1e1170, 0x4e6c5a72, 0xfbfd0eff, 0x560f8538, 0x1e3daed5, 0x27362d39, 0x640a0fd9, 0x21685ca6, 0xd19b5b54, 0x3a24362e, 0xb10c0a67, 0x0f9357e7, 0xd2b4ee96, 0x9e1b9b91, 0x4f80c0c5, 0xa261dc20, 0x695a774b, 0x161c121a, 0x0ae293ba, 0xe5c0a02a, 0x433c22e0, 0x1d121b17, 0x0b0e090d, 0xadf28bc7, 0xb92db6a8, 0xc8141ea9, 0x8557f119, 0x4caf7507, 0xbbee99dd, 0xfda37f60, 0x9ff70126, 0xbc5c72f5, 0xc544663b, 0x345bfb7e, 0x768b4329, 0xdccb23c6, 0x68b6edfc, 0x63b8e4f1, 0xcad731dc, 0x10426385, 0x40139722, 0x2084c611, 0x7d854a24, 0xf8d2bb3d, 0x11aef932, 0x6dc729a1, 0x4b1d9e2f, 0xf3dcb230, 0xec0d8652, 0xd077c1e3, 0x6c2bb316, 0x99a970b9, 0xfa119448, 0x2247e964, 0xc4a8fc8c, 0x1aa0f03f, 0xd8567d2c, 0xef223390, 0xc787494e, 0xc1d938d1, 0xfe8ccaa2, 0x3698d40b, 0xcfa6f581, 0x28a57ade, 0x26dab78e, 0xa43fadbf, 0xe42c3a9d, 0x0d507892, 0x9b6a5fcc, 0x62547e46, 0xc2f68d13, 0xe890d8b8, 0x5e2e39f7, 0xf582c3af, 0xbe9f5d80, 0x7c69d093, 0xa96fd52d, 0xb3cf2512, 0x3bc8ac99, 0xa710187d, 0x6ee89c63, 0x7bdb3bbb, 0x09cd2678, 0xf46e5918, 0x01ec9ab7, 0xa8834f9a, 0x65e6956e, 0x7eaaffe6, 0x0821bccf, 0xe6ef15e8, 0xd9bae79b, 0xce4a6f36, 0xd4ea9f09, 0xd629b07c, 0xaf31a4b2, 0x312a3f23, 0x30c6a594, 0xc035a266, 0x37744ebc, 0xa6fc82ca, 0xb0e090d0, 0x1533a7d8, 0x4af10498, 0xf741ecda, 0x0e7fcd50, 0x2f1791f6, 0x8d764dd6, 0x4d43efb0, 0x54ccaa4d, 0xdfe49604, 0xe39ed1b5, 0x1b4c6a88, 0xb8c12c1f, 0x7f466551, 0x049d5eea, 0x5d018c35, 0x73fa8774, 0x2efb0b41, 0x5ab3671d, 0x5292dbd2, 0x33e91056, 0x136dd647, 0x8c9ad761, 0x7a37a10c, 0x8e59f814, 0x89eb133c, 0xeecea927, 0x35b761c9, 0xede11ce5, 0x3c7a47b1, 0x599cd2df, 0x3f55f273, 0x791814ce, 0xbf73c737, 0xea53f7cd, 0x5b5ffdaa, 0x14df3d6f, 0x867844db, 0x81caaff3, 0x3eb968c4, 0x2c382434, 0x5fc2a340, 0x72161dc3, 0x0cbce225, 0x8b283c49, 0x41ff0d95, 0x7139a801, 0xde080cb3, 0x9cd8b4e4, 0x906456c1, 0x617bcb84, 0x70d532b6, 0x74486c5c, 0x42d0b857];
var T7 = [0xa75051f4, 0x65537e41, 0xa4c31a17, 0x5e963a27, 0x6bcb3bab, 0x45f11f9d, 0x58abacfa, 0x03934be3, 0xfa552030, 0x6df6ad76, 0x769188cc, 0x4c25f502, 0xd7fc4fe5, 0xcbd7c52a, 0x44802635, 0xa38fb562, 0x5a49deb1, 0x1b6725ba, 0x0e9845ea, 0xc0e15dfe, 0x7502c32f, 0xf012814c, 0x97a38d46, 0xf9c66bd3, 0x5fe7038f, 0x9c951592, 0x7aebbf6d, 0x59da9552, 0x832dd4be, 0x21d35874, 0x692949e0, 0xc8448ec9, 0x896a75c2, 0x7978f48e, 0x3e6b9958, 0x71dd27b9, 0x4fb6bee1, 0xad17f088, 0xac66c920, 0x3ab47dce, 0x4a1863df, 0x3182e51a, 0x33609751, 0x7f456253, 0x77e0b164, 0xae84bb6b, 0xa01cfe81, 0x2b94f908, 0x68587048, 0xfd198f45, 0x6c8794de, 0xf8b7527b, 0xd323ab73, 0x02e2724b, 0x8f57e31f, 0xab2a6655, 0x2807b2eb, 0xc2032fb5, 0x7b9a86c5, 0x08a5d337, 0x87f23028, 0xa5b223bf, 0x6aba0203, 0x825ced16, 0x1c2b8acf, 0xb492a779, 0xf2f0f307, 0xe2a14e69, 0xf4cd65da, 0xbed50605, 0x621fd134, 0xfe8ac4a6, 0x539d342e, 0x55a0a2f3, 0xe132058a, 0xeb75a4f6, 0xec390b83, 0xefaa4060, 0x9f065e71, 0x1051bd6e, 0x8af93e21, 0x063d96dd, 0x05aedd3e, 0xbd464de6, 0x8db59154, 0x5d0571c4, 0xd46f0406, 0x15ff6050, 0xfb241998, 0xe997d6bd, 0x43cc8940, 0x9e7767d9, 0x42bdb0e8, 0x8b880789, 0x5b38e719, 0xeedb79c8, 0x0a47a17c, 0x0fe97c42, 0x1ec9f884, 0x00000000, 0x86830980, 0xed48322b, 0x70ac1e11, 0x724e6c5a, 0xfffbfd0e, 0x38560f85, 0xd51e3dae, 0x3927362d, 0xd9640a0f, 0xa621685c, 0x54d19b5b, 0x2e3a2436, 0x67b10c0a, 0xe70f9357, 0x96d2b4ee, 0x919e1b9b, 0xc54f80c0, 0x20a261dc, 0x4b695a77, 0x1a161c12, 0xba0ae293, 0x2ae5c0a0, 0xe0433c22, 0x171d121b, 0x0d0b0e09, 0xc7adf28b, 0xa8b92db6, 0xa9c8141e, 0x198557f1, 0x074caf75, 0xddbbee99, 0x60fda37f, 0x269ff701, 0xf5bc5c72, 0x3bc54466, 0x7e345bfb, 0x29768b43, 0xc6dccb23, 0xfc68b6ed, 0xf163b8e4, 0xdccad731, 0x85104263, 0x22401397, 0x112084c6, 0x247d854a, 0x3df8d2bb, 0x3211aef9, 0xa16dc729, 0x2f4b1d9e, 0x30f3dcb2, 0x52ec0d86, 0xe3d077c1, 0x166c2bb3, 0xb999a970, 0x48fa1194, 0x642247e9, 0x8cc4a8fc, 0x3f1aa0f0, 0x2cd8567d, 0x90ef2233, 0x4ec78749, 0xd1c1d938, 0xa2fe8cca, 0x0b3698d4, 0x81cfa6f5, 0xde28a57a, 0x8e26dab7, 0xbfa43fad, 0x9de42c3a, 0x920d5078, 0xcc9b6a5f, 0x4662547e, 0x13c2f68d, 0xb8e890d8, 0xf75e2e39, 0xaff582c3, 0x80be9f5d, 0x937c69d0, 0x2da96fd5, 0x12b3cf25, 0x993bc8ac, 0x7da71018, 0x636ee89c, 0xbb7bdb3b, 0x7809cd26, 0x18f46e59, 0xb701ec9a, 0x9aa8834f, 0x6e65e695, 0xe67eaaff, 0xcf0821bc, 0xe8e6ef15, 0x9bd9bae7, 0x36ce4a6f, 0x09d4ea9f, 0x7cd629b0, 0xb2af31a4, 0x23312a3f, 0x9430c6a5, 0x66c035a2, 0xbc37744e, 0xcaa6fc82, 0xd0b0e090, 0xd81533a7, 0x984af104, 0xdaf741ec, 0x500e7fcd, 0xf62f1791, 0xd68d764d, 0xb04d43ef, 0x4d54ccaa, 0x04dfe496, 0xb5e39ed1, 0x881b4c6a, 0x1fb8c12c, 0x517f4665, 0xea049d5e, 0x355d018c, 0x7473fa87, 0x412efb0b, 0x1d5ab367, 0xd25292db, 0x5633e910, 0x47136dd6, 0x618c9ad7, 0x0c7a37a1, 0x148e59f8, 0x3c89eb13, 0x27eecea9, 0xc935b761, 0xe5ede11c, 0xb13c7a47, 0xdf599cd2, 0x733f55f2, 0xce791814, 0x37bf73c7, 0xcdea53f7, 0xaa5b5ffd, 0x6f14df3d, 0xdb867844, 0xf381caaf, 0xc43eb968, 0x342c3824, 0x405fc2a3, 0xc372161d, 0x250cbce2, 0x498b283c, 0x9541ff0d, 0x017139a8, 0xb3de080c, 0xe49cd8b4, 0xc1906456, 0x84617bcb, 0xb670d532, 0x5c74486c, 0x5742d0b8];
var T8 = [0xf4a75051, 0x4165537e, 0x17a4c31a, 0x275e963a, 0xab6bcb3b, 0x9d45f11f, 0xfa58abac, 0xe303934b, 0x30fa5520, 0x766df6ad, 0xcc769188, 0x024c25f5, 0xe5d7fc4f, 0x2acbd7c5, 0x35448026, 0x62a38fb5, 0xb15a49de, 0xba1b6725, 0xea0e9845, 0xfec0e15d, 0x2f7502c3, 0x4cf01281, 0x4697a38d, 0xd3f9c66b, 0x8f5fe703, 0x929c9515, 0x6d7aebbf, 0x5259da95, 0xbe832dd4, 0x7421d358, 0xe0692949, 0xc9c8448e, 0xc2896a75, 0x8e7978f4, 0x583e6b99, 0xb971dd27, 0xe14fb6be, 0x88ad17f0, 0x20ac66c9, 0xce3ab47d, 0xdf4a1863, 0x1a3182e5, 0x51336097, 0x537f4562, 0x6477e0b1, 0x6bae84bb, 0x81a01cfe, 0x082b94f9, 0x48685870, 0x45fd198f, 0xde6c8794, 0x7bf8b752, 0x73d323ab, 0x4b02e272, 0x1f8f57e3, 0x55ab2a66, 0xeb2807b2, 0xb5c2032f, 0xc57b9a86, 0x3708a5d3, 0x2887f230, 0xbfa5b223, 0x036aba02, 0x16825ced, 0xcf1c2b8a, 0x79b492a7, 0x07f2f0f3, 0x69e2a14e, 0xdaf4cd65, 0x05bed506, 0x34621fd1, 0xa6fe8ac4, 0x2e539d34, 0xf355a0a2, 0x8ae13205, 0xf6eb75a4, 0x83ec390b, 0x60efaa40, 0x719f065e, 0x6e1051bd, 0x218af93e, 0xdd063d96, 0x3e05aedd, 0xe6bd464d, 0x548db591, 0xc45d0571, 0x06d46f04, 0x5015ff60, 0x98fb2419, 0xbde997d6, 0x4043cc89, 0xd99e7767, 0xe842bdb0, 0x898b8807, 0x195b38e7, 0xc8eedb79, 0x7c0a47a1, 0x420fe97c, 0x841ec9f8, 0x00000000, 0x80868309, 0x2bed4832, 0x1170ac1e, 0x5a724e6c, 0x0efffbfd, 0x8538560f, 0xaed51e3d, 0x2d392736, 0x0fd9640a, 0x5ca62168, 0x5b54d19b, 0x362e3a24, 0x0a67b10c, 0x57e70f93, 0xee96d2b4, 0x9b919e1b, 0xc0c54f80, 0xdc20a261, 0x774b695a, 0x121a161c, 0x93ba0ae2, 0xa02ae5c0, 0x22e0433c, 0x1b171d12, 0x090d0b0e, 0x8bc7adf2, 0xb6a8b92d, 0x1ea9c814, 0xf1198557, 0x75074caf, 0x99ddbbee, 0x7f60fda3, 0x01269ff7, 0x72f5bc5c, 0x663bc544, 0xfb7e345b, 0x4329768b, 0x23c6dccb, 0xedfc68b6, 0xe4f163b8, 0x31dccad7, 0x63851042, 0x97224013, 0xc6112084, 0x4a247d85, 0xbb3df8d2, 0xf93211ae, 0x29a16dc7, 0x9e2f4b1d, 0xb230f3dc, 0x8652ec0d, 0xc1e3d077, 0xb3166c2b, 0x70b999a9, 0x9448fa11, 0xe9642247, 0xfc8cc4a8, 0xf03f1aa0, 0x7d2cd856, 0x3390ef22, 0x494ec787, 0x38d1c1d9, 0xcaa2fe8c, 0xd40b3698, 0xf581cfa6, 0x7ade28a5, 0xb78e26da, 0xadbfa43f, 0x3a9de42c, 0x78920d50, 0x5fcc9b6a, 0x7e466254, 0x8d13c2f6, 0xd8b8e890, 0x39f75e2e, 0xc3aff582, 0x5d80be9f, 0xd0937c69, 0xd52da96f, 0x2512b3cf, 0xac993bc8, 0x187da710, 0x9c636ee8, 0x3bbb7bdb, 0x267809cd, 0x5918f46e, 0x9ab701ec, 0x4f9aa883, 0x956e65e6, 0xffe67eaa, 0xbccf0821, 0x15e8e6ef, 0xe79bd9ba, 0x6f36ce4a, 0x9f09d4ea, 0xb07cd629, 0xa4b2af31, 0x3f23312a, 0xa59430c6, 0xa266c035, 0x4ebc3774, 0x82caa6fc, 0x90d0b0e0, 0xa7d81533, 0x04984af1, 0xecdaf741, 0xcd500e7f, 0x91f62f17, 0x4dd68d76, 0xefb04d43, 0xaa4d54cc, 0x9604dfe4, 0xd1b5e39e, 0x6a881b4c, 0x2c1fb8c1, 0x65517f46, 0x5eea049d, 0x8c355d01, 0x877473fa, 0x0b412efb, 0x671d5ab3, 0xdbd25292, 0x105633e9, 0xd647136d, 0xd7618c9a, 0xa10c7a37, 0xf8148e59, 0x133c89eb, 0xa927eece, 0x61c935b7, 0x1ce5ede1, 0x47b13c7a, 0xd2df599c, 0xf2733f55, 0x14ce7918, 0xc737bf73, 0xf7cdea53, 0xfdaa5b5f, 0x3d6f14df, 0x44db8678, 0xaff381ca, 0x68c43eb9, 0x24342c38, 0xa3405fc2, 0x1dc37216, 0xe2250cbc, 0x3c498b28, 0x0d9541ff, 0xa8017139, 0x0cb3de08, 0xb4e49cd8, 0x56c19064, 0xcb84617b, 0x32b670d5, 0x6c5c7448, 0xb85742d0];

// Transformations for decryption key expansion
var U1 = [0x00000000, 0x0e090d0b, 0x1c121a16, 0x121b171d, 0x3824342c, 0x362d3927, 0x24362e3a, 0x2a3f2331, 0x70486858, 0x7e416553, 0x6c5a724e, 0x62537f45, 0x486c5c74, 0x4665517f, 0x547e4662, 0x5a774b69, 0xe090d0b0, 0xee99ddbb, 0xfc82caa6, 0xf28bc7ad, 0xd8b4e49c, 0xd6bde997, 0xc4a6fe8a, 0xcaaff381, 0x90d8b8e8, 0x9ed1b5e3, 0x8ccaa2fe, 0x82c3aff5, 0xa8fc8cc4, 0xa6f581cf, 0xb4ee96d2, 0xbae79bd9, 0xdb3bbb7b, 0xd532b670, 0xc729a16d, 0xc920ac66, 0xe31f8f57, 0xed16825c, 0xff0d9541, 0xf104984a, 0xab73d323, 0xa57ade28, 0xb761c935, 0xb968c43e, 0x9357e70f, 0x9d5eea04, 0x8f45fd19, 0x814cf012, 0x3bab6bcb, 0x35a266c0, 0x27b971dd, 0x29b07cd6, 0x038f5fe7, 0x0d8652ec, 0x1f9d45f1, 0x119448fa, 0x4be30393, 0x45ea0e98, 0x57f11985, 0x59f8148e, 0x73c737bf, 0x7dce3ab4, 0x6fd52da9, 0x61dc20a2, 0xad766df6, 0xa37f60fd, 0xb16477e0, 0xbf6d7aeb, 0x955259da, 0x9b5b54d1, 0x894043cc, 0x87494ec7, 0xdd3e05ae, 0xd33708a5, 0xc12c1fb8, 0xcf2512b3, 0xe51a3182, 0xeb133c89, 0xf9082b94, 0xf701269f, 0x4de6bd46, 0x43efb04d, 0x51f4a750, 0x5ffdaa5b, 0x75c2896a, 0x7bcb8461, 0x69d0937c, 0x67d99e77, 0x3daed51e, 0x33a7d815, 0x21bccf08, 0x2fb5c203, 0x058ae132, 0x0b83ec39, 0x1998fb24, 0x1791f62f, 0x764dd68d, 0x7844db86, 0x6a5fcc9b, 0x6456c190, 0x4e69e2a1, 0x4060efaa, 0x527bf8b7, 0x5c72f5bc, 0x0605bed5, 0x080cb3de, 0x1a17a4c3, 0x141ea9c8, 0x3e218af9, 0x302887f2, 0x223390ef, 0x2c3a9de4, 0x96dd063d, 0x98d40b36, 0x8acf1c2b, 0x84c61120, 0xaef93211, 0xa0f03f1a, 0xb2eb2807, 0xbce2250c, 0xe6956e65, 0xe89c636e, 0xfa877473, 0xf48e7978, 0xdeb15a49, 0xd0b85742, 0xc2a3405f, 0xccaa4d54, 0x41ecdaf7, 0x4fe5d7fc, 0x5dfec0e1, 0x53f7cdea, 0x79c8eedb, 0x77c1e3d0, 0x65daf4cd, 0x6bd3f9c6, 0x31a4b2af, 0x3fadbfa4, 0x2db6a8b9, 0x23bfa5b2, 0x09808683, 0x07898b88, 0x15929c95, 0x1b9b919e, 0xa17c0a47, 0xaf75074c, 0xbd6e1051, 0xb3671d5a, 0x99583e6b, 0x97513360, 0x854a247d, 0x8b432976, 0xd134621f, 0xdf3d6f14, 0xcd267809, 0xc32f7502, 0xe9105633, 0xe7195b38, 0xf5024c25, 0xfb0b412e, 0x9ad7618c, 0x94de6c87, 0x86c57b9a, 0x88cc7691, 0xa2f355a0, 0xacfa58ab, 0xbee14fb6, 0xb0e842bd, 0xea9f09d4, 0xe49604df, 0xf68d13c2, 0xf8841ec9, 0xd2bb3df8, 0xdcb230f3, 0xcea927ee, 0xc0a02ae5, 0x7a47b13c, 0x744ebc37, 0x6655ab2a, 0x685ca621, 0x42638510, 0x4c6a881b, 0x5e719f06, 0x5078920d, 0x0a0fd964, 0x0406d46f, 0x161dc372, 0x1814ce79, 0x322bed48, 0x3c22e043, 0x2e39f75e, 0x2030fa55, 0xec9ab701, 0xe293ba0a, 0xf088ad17, 0xfe81a01c, 0xd4be832d, 0xdab78e26, 0xc8ac993b, 0xc6a59430, 0x9cd2df59, 0x92dbd252, 0x80c0c54f, 0x8ec9c844, 0xa4f6eb75, 0xaaffe67e, 0xb8e4f163, 0xb6edfc68, 0x0c0a67b1, 0x02036aba, 0x10187da7, 0x1e1170ac, 0x342e539d, 0x3a275e96, 0x283c498b, 0x26354480, 0x7c420fe9, 0x724b02e2, 0x605015ff, 0x6e5918f4, 0x44663bc5, 0x4a6f36ce, 0x587421d3, 0x567d2cd8, 0x37a10c7a, 0x39a80171, 0x2bb3166c, 0x25ba1b67, 0x0f853856, 0x018c355d, 0x13972240, 0x1d9e2f4b, 0x47e96422, 0x49e06929, 0x5bfb7e34, 0x55f2733f, 0x7fcd500e, 0x71c45d05, 0x63df4a18, 0x6dd64713, 0xd731dcca, 0xd938d1c1, 0xcb23c6dc, 0xc52acbd7, 0xef15e8e6, 0xe11ce5ed, 0xf307f2f0, 0xfd0efffb, 0xa779b492, 0xa970b999, 0xbb6bae84, 0xb562a38f, 0x9f5d80be, 0x91548db5, 0x834f9aa8, 0x8d4697a3];
var U2 = [0x00000000, 0x0b0e090d, 0x161c121a, 0x1d121b17, 0x2c382434, 0x27362d39, 0x3a24362e, 0x312a3f23, 0x58704868, 0x537e4165, 0x4e6c5a72, 0x4562537f, 0x74486c5c, 0x7f466551, 0x62547e46, 0x695a774b, 0xb0e090d0, 0xbbee99dd, 0xa6fc82ca, 0xadf28bc7, 0x9cd8b4e4, 0x97d6bde9, 0x8ac4a6fe, 0x81caaff3, 0xe890d8b8, 0xe39ed1b5, 0xfe8ccaa2, 0xf582c3af, 0xc4a8fc8c, 0xcfa6f581, 0xd2b4ee96, 0xd9bae79b, 0x7bdb3bbb, 0x70d532b6, 0x6dc729a1, 0x66c920ac, 0x57e31f8f, 0x5ced1682, 0x41ff0d95, 0x4af10498, 0x23ab73d3, 0x28a57ade, 0x35b761c9, 0x3eb968c4, 0x0f9357e7, 0x049d5eea, 0x198f45fd, 0x12814cf0, 0xcb3bab6b, 0xc035a266, 0xdd27b971, 0xd629b07c, 0xe7038f5f, 0xec0d8652, 0xf11f9d45, 0xfa119448, 0x934be303, 0x9845ea0e, 0x8557f119, 0x8e59f814, 0xbf73c737, 0xb47dce3a, 0xa96fd52d, 0xa261dc20, 0xf6ad766d, 0xfda37f60, 0xe0b16477, 0xebbf6d7a, 0xda955259, 0xd19b5b54, 0xcc894043, 0xc787494e, 0xaedd3e05, 0xa5d33708, 0xb8c12c1f, 0xb3cf2512, 0x82e51a31, 0x89eb133c, 0x94f9082b, 0x9ff70126, 0x464de6bd, 0x4d43efb0, 0x5051f4a7, 0x5b5ffdaa, 0x6a75c289, 0x617bcb84, 0x7c69d093, 0x7767d99e, 0x1e3daed5, 0x1533a7d8, 0x0821bccf, 0x032fb5c2, 0x32058ae1, 0x390b83ec, 0x241998fb, 0x2f1791f6, 0x8d764dd6, 0x867844db, 0x9b6a5fcc, 0x906456c1, 0xa14e69e2, 0xaa4060ef, 0xb7527bf8, 0xbc5c72f5, 0xd50605be, 0xde080cb3, 0xc31a17a4, 0xc8141ea9, 0xf93e218a, 0xf2302887, 0xef223390, 0xe42c3a9d, 0x3d96dd06, 0x3698d40b, 0x2b8acf1c, 0x2084c611, 0x11aef932, 0x1aa0f03f, 0x07b2eb28, 0x0cbce225, 0x65e6956e, 0x6ee89c63, 0x73fa8774, 0x78f48e79, 0x49deb15a, 0x42d0b857, 0x5fc2a340, 0x54ccaa4d, 0xf741ecda, 0xfc4fe5d7, 0xe15dfec0, 0xea53f7cd, 0xdb79c8ee, 0xd077c1e3, 0xcd65daf4, 0xc66bd3f9, 0xaf31a4b2, 0xa43fadbf, 0xb92db6a8, 0xb223bfa5, 0x83098086, 0x8807898b, 0x9515929c, 0x9e1b9b91, 0x47a17c0a, 0x4caf7507, 0x51bd6e10, 0x5ab3671d, 0x6b99583e, 0x60975133, 0x7d854a24, 0x768b4329, 0x1fd13462, 0x14df3d6f, 0x09cd2678, 0x02c32f75, 0x33e91056, 0x38e7195b, 0x25f5024c, 0x2efb0b41, 0x8c9ad761, 0x8794de6c, 0x9a86c57b, 0x9188cc76, 0xa0a2f355, 0xabacfa58, 0xb6bee14f, 0xbdb0e842, 0xd4ea9f09, 0xdfe49604, 0xc2f68d13, 0xc9f8841e, 0xf8d2bb3d, 0xf3dcb230, 0xeecea927, 0xe5c0a02a, 0x3c7a47b1, 0x37744ebc, 0x2a6655ab, 0x21685ca6, 0x10426385, 0x1b4c6a88, 0x065e719f, 0x0d507892, 0x640a0fd9, 0x6f0406d4, 0x72161dc3, 0x791814ce, 0x48322bed, 0x433c22e0, 0x5e2e39f7, 0x552030fa, 0x01ec9ab7, 0x0ae293ba, 0x17f088ad, 0x1cfe81a0, 0x2dd4be83, 0x26dab78e, 0x3bc8ac99, 0x30c6a594, 0x599cd2df, 0x5292dbd2, 0x4f80c0c5, 0x448ec9c8, 0x75a4f6eb, 0x7eaaffe6, 0x63b8e4f1, 0x68b6edfc, 0xb10c0a67, 0xba02036a, 0xa710187d, 0xac1e1170, 0x9d342e53, 0x963a275e, 0x8b283c49, 0x80263544, 0xe97c420f, 0xe2724b02, 0xff605015, 0xf46e5918, 0xc544663b, 0xce4a6f36, 0xd3587421, 0xd8567d2c, 0x7a37a10c, 0x7139a801, 0x6c2bb316, 0x6725ba1b, 0x560f8538, 0x5d018c35, 0x40139722, 0x4b1d9e2f, 0x2247e964, 0x2949e069, 0x345bfb7e, 0x3f55f273, 0x0e7fcd50, 0x0571c45d, 0x1863df4a, 0x136dd647, 0xcad731dc, 0xc1d938d1, 0xdccb23c6, 0xd7c52acb, 0xe6ef15e8, 0xede11ce5, 0xf0f307f2, 0xfbfd0eff, 0x92a779b4, 0x99a970b9, 0x84bb6bae, 0x8fb562a3, 0xbe9f5d80, 0xb591548d, 0xa8834f9a, 0xa38d4697];
var U3 = [0x00000000, 0x0d0b0e09, 0x1a161c12, 0x171d121b, 0x342c3824, 0x3927362d, 0x2e3a2436, 0x23312a3f, 0x68587048, 0x65537e41, 0x724e6c5a, 0x7f456253, 0x5c74486c, 0x517f4665, 0x4662547e, 0x4b695a77, 0xd0b0e090, 0xddbbee99, 0xcaa6fc82, 0xc7adf28b, 0xe49cd8b4, 0xe997d6bd, 0xfe8ac4a6, 0xf381caaf, 0xb8e890d8, 0xb5e39ed1, 0xa2fe8cca, 0xaff582c3, 0x8cc4a8fc, 0x81cfa6f5, 0x96d2b4ee, 0x9bd9bae7, 0xbb7bdb3b, 0xb670d532, 0xa16dc729, 0xac66c920, 0x8f57e31f, 0x825ced16, 0x9541ff0d, 0x984af104, 0xd323ab73, 0xde28a57a, 0xc935b761, 0xc43eb968, 0xe70f9357, 0xea049d5e, 0xfd198f45, 0xf012814c, 0x6bcb3bab, 0x66c035a2, 0x71dd27b9, 0x7cd629b0, 0x5fe7038f, 0x52ec0d86, 0x45f11f9d, 0x48fa1194, 0x03934be3, 0x0e9845ea, 0x198557f1, 0x148e59f8, 0x37bf73c7, 0x3ab47dce, 0x2da96fd5, 0x20a261dc, 0x6df6ad76, 0x60fda37f, 0x77e0b164, 0x7aebbf6d, 0x59da9552, 0x54d19b5b, 0x43cc8940, 0x4ec78749, 0x05aedd3e, 0x08a5d337, 0x1fb8c12c, 0x12b3cf25, 0x3182e51a, 0x3c89eb13, 0x2b94f908, 0x269ff701, 0xbd464de6, 0xb04d43ef, 0xa75051f4, 0xaa5b5ffd, 0x896a75c2, 0x84617bcb, 0x937c69d0, 0x9e7767d9, 0xd51e3dae, 0xd81533a7, 0xcf0821bc, 0xc2032fb5, 0xe132058a, 0xec390b83, 0xfb241998, 0xf62f1791, 0xd68d764d, 0xdb867844, 0xcc9b6a5f, 0xc1906456, 0xe2a14e69, 0xefaa4060, 0xf8b7527b, 0xf5bc5c72, 0xbed50605, 0xb3de080c, 0xa4c31a17, 0xa9c8141e, 0x8af93e21, 0x87f23028, 0x90ef2233, 0x9de42c3a, 0x063d96dd, 0x0b3698d4, 0x1c2b8acf, 0x112084c6, 0x3211aef9, 0x3f1aa0f0, 0x2807b2eb, 0x250cbce2, 0x6e65e695, 0x636ee89c, 0x7473fa87, 0x7978f48e, 0x5a49deb1, 0x5742d0b8, 0x405fc2a3, 0x4d54ccaa, 0xdaf741ec, 0xd7fc4fe5, 0xc0e15dfe, 0xcdea53f7, 0xeedb79c8, 0xe3d077c1, 0xf4cd65da, 0xf9c66bd3, 0xb2af31a4, 0xbfa43fad, 0xa8b92db6, 0xa5b223bf, 0x86830980, 0x8b880789, 0x9c951592, 0x919e1b9b, 0x0a47a17c, 0x074caf75, 0x1051bd6e, 0x1d5ab367, 0x3e6b9958, 0x33609751, 0x247d854a, 0x29768b43, 0x621fd134, 0x6f14df3d, 0x7809cd26, 0x7502c32f, 0x5633e910, 0x5b38e719, 0x4c25f502, 0x412efb0b, 0x618c9ad7, 0x6c8794de, 0x7b9a86c5, 0x769188cc, 0x55a0a2f3, 0x58abacfa, 0x4fb6bee1, 0x42bdb0e8, 0x09d4ea9f, 0x04dfe496, 0x13c2f68d, 0x1ec9f884, 0x3df8d2bb, 0x30f3dcb2, 0x27eecea9, 0x2ae5c0a0, 0xb13c7a47, 0xbc37744e, 0xab2a6655, 0xa621685c, 0x85104263, 0x881b4c6a, 0x9f065e71, 0x920d5078, 0xd9640a0f, 0xd46f0406, 0xc372161d, 0xce791814, 0xed48322b, 0xe0433c22, 0xf75e2e39, 0xfa552030, 0xb701ec9a, 0xba0ae293, 0xad17f088, 0xa01cfe81, 0x832dd4be, 0x8e26dab7, 0x993bc8ac, 0x9430c6a5, 0xdf599cd2, 0xd25292db, 0xc54f80c0, 0xc8448ec9, 0xeb75a4f6, 0xe67eaaff, 0xf163b8e4, 0xfc68b6ed, 0x67b10c0a, 0x6aba0203, 0x7da71018, 0x70ac1e11, 0x539d342e, 0x5e963a27, 0x498b283c, 0x44802635, 0x0fe97c42, 0x02e2724b, 0x15ff6050, 0x18f46e59, 0x3bc54466, 0x36ce4a6f, 0x21d35874, 0x2cd8567d, 0x0c7a37a1, 0x017139a8, 0x166c2bb3, 0x1b6725ba, 0x38560f85, 0x355d018c, 0x22401397, 0x2f4b1d9e, 0x642247e9, 0x692949e0, 0x7e345bfb, 0x733f55f2, 0x500e7fcd, 0x5d0571c4, 0x4a1863df, 0x47136dd6, 0xdccad731, 0xd1c1d938, 0xc6dccb23, 0xcbd7c52a, 0xe8e6ef15, 0xe5ede11c, 0xf2f0f307, 0xfffbfd0e, 0xb492a779, 0xb999a970, 0xae84bb6b, 0xa38fb562, 0x80be9f5d, 0x8db59154, 0x9aa8834f, 0x97a38d46];
var U4 = [0x00000000, 0x090d0b0e, 0x121a161c, 0x1b171d12, 0x24342c38, 0x2d392736, 0x362e3a24, 0x3f23312a, 0x48685870, 0x4165537e, 0x5a724e6c, 0x537f4562, 0x6c5c7448, 0x65517f46, 0x7e466254, 0x774b695a, 0x90d0b0e0, 0x99ddbbee, 0x82caa6fc, 0x8bc7adf2, 0xb4e49cd8, 0xbde997d6, 0xa6fe8ac4, 0xaff381ca, 0xd8b8e890, 0xd1b5e39e, 0xcaa2fe8c, 0xc3aff582, 0xfc8cc4a8, 0xf581cfa6, 0xee96d2b4, 0xe79bd9ba, 0x3bbb7bdb, 0x32b670d5, 0x29a16dc7, 0x20ac66c9, 0x1f8f57e3, 0x16825ced, 0x0d9541ff, 0x04984af1, 0x73d323ab, 0x7ade28a5, 0x61c935b7, 0x68c43eb9, 0x57e70f93, 0x5eea049d, 0x45fd198f, 0x4cf01281, 0xab6bcb3b, 0xa266c035, 0xb971dd27, 0xb07cd629, 0x8f5fe703, 0x8652ec0d, 0x9d45f11f, 0x9448fa11, 0xe303934b, 0xea0e9845, 0xf1198557, 0xf8148e59, 0xc737bf73, 0xce3ab47d, 0xd52da96f, 0xdc20a261, 0x766df6ad, 0x7f60fda3, 0x6477e0b1, 0x6d7aebbf, 0x5259da95, 0x5b54d19b, 0x4043cc89, 0x494ec787, 0x3e05aedd, 0x3708a5d3, 0x2c1fb8c1, 0x2512b3cf, 0x1a3182e5, 0x133c89eb, 0x082b94f9, 0x01269ff7, 0xe6bd464d, 0xefb04d43, 0xf4a75051, 0xfdaa5b5f, 0xc2896a75, 0xcb84617b, 0xd0937c69, 0xd99e7767, 0xaed51e3d, 0xa7d81533, 0xbccf0821, 0xb5c2032f, 0x8ae13205, 0x83ec390b, 0x98fb2419, 0x91f62f17, 0x4dd68d76, 0x44db8678, 0x5fcc9b6a, 0x56c19064, 0x69e2a14e, 0x60efaa40, 0x7bf8b752, 0x72f5bc5c, 0x05bed506, 0x0cb3de08, 0x17a4c31a, 0x1ea9c814, 0x218af93e, 0x2887f230, 0x3390ef22, 0x3a9de42c, 0xdd063d96, 0xd40b3698, 0xcf1c2b8a, 0xc6112084, 0xf93211ae, 0xf03f1aa0, 0xeb2807b2, 0xe2250cbc, 0x956e65e6, 0x9c636ee8, 0x877473fa, 0x8e7978f4, 0xb15a49de, 0xb85742d0, 0xa3405fc2, 0xaa4d54cc, 0xecdaf741, 0xe5d7fc4f, 0xfec0e15d, 0xf7cdea53, 0xc8eedb79, 0xc1e3d077, 0xdaf4cd65, 0xd3f9c66b, 0xa4b2af31, 0xadbfa43f, 0xb6a8b92d, 0xbfa5b223, 0x80868309, 0x898b8807, 0x929c9515, 0x9b919e1b, 0x7c0a47a1, 0x75074caf, 0x6e1051bd, 0x671d5ab3, 0x583e6b99, 0x51336097, 0x4a247d85, 0x4329768b, 0x34621fd1, 0x3d6f14df, 0x267809cd, 0x2f7502c3, 0x105633e9, 0x195b38e7, 0x024c25f5, 0x0b412efb, 0xd7618c9a, 0xde6c8794, 0xc57b9a86, 0xcc769188, 0xf355a0a2, 0xfa58abac, 0xe14fb6be, 0xe842bdb0, 0x9f09d4ea, 0x9604dfe4, 0x8d13c2f6, 0x841ec9f8, 0xbb3df8d2, 0xb230f3dc, 0xa927eece, 0xa02ae5c0, 0x47b13c7a, 0x4ebc3774, 0x55ab2a66, 0x5ca62168, 0x63851042, 0x6a881b4c, 0x719f065e, 0x78920d50, 0x0fd9640a, 0x06d46f04, 0x1dc37216, 0x14ce7918, 0x2bed4832, 0x22e0433c, 0x39f75e2e, 0x30fa5520, 0x9ab701ec, 0x93ba0ae2, 0x88ad17f0, 0x81a01cfe, 0xbe832dd4, 0xb78e26da, 0xac993bc8, 0xa59430c6, 0xd2df599c, 0xdbd25292, 0xc0c54f80, 0xc9c8448e, 0xf6eb75a4, 0xffe67eaa, 0xe4f163b8, 0xedfc68b6, 0x0a67b10c, 0x036aba02, 0x187da710, 0x1170ac1e, 0x2e539d34, 0x275e963a, 0x3c498b28, 0x35448026, 0x420fe97c, 0x4b02e272, 0x5015ff60, 0x5918f46e, 0x663bc544, 0x6f36ce4a, 0x7421d358, 0x7d2cd856, 0xa10c7a37, 0xa8017139, 0xb3166c2b, 0xba1b6725, 0x8538560f, 0x8c355d01, 0x97224013, 0x9e2f4b1d, 0xe9642247, 0xe0692949, 0xfb7e345b, 0xf2733f55, 0xcd500e7f, 0xc45d0571, 0xdf4a1863, 0xd647136d, 0x31dccad7, 0x38d1c1d9, 0x23c6dccb, 0x2acbd7c5, 0x15e8e6ef, 0x1ce5ede1, 0x07f2f0f3, 0x0efffbfd, 0x79b492a7, 0x70b999a9, 0x6bae84bb, 0x62a38fb5, 0x5d80be9f, 0x548db591, 0x4f9aa883, 0x4697a38d];

function convertToInt32(bytes) {
  var result = [];
  for (var i = 0; i < bytes.length; i += 4) {
    result.push(
      (bytes[i] << 24) |
      (bytes[i + 1] << 16) |
      (bytes[i + 2] << 8) |
      bytes[i + 3]
    );
  }
  return result;
}

var AES = function (key) {
  if (!(this instanceof AES)) {
    throw Error('AES must be instanitated with `new`');
  }

  Object.defineProperty(this, 'key', {
    value: coerceArray(key, true)
  });

  this._prepare();
}


AES.prototype._prepare = function () {

  var rounds = numberOfRounds[this.key.length];
  if (rounds == null) {
    throw new Error('invalid key size (must be 16, 24 or 32 bytes)');
  }

  // encryption round keys
  this._Ke = [];

  // decryption round keys
  this._Kd = [];

  for (var i = 0; i <= rounds; i++) {
    this._Ke.push([0, 0, 0, 0]);
    this._Kd.push([0, 0, 0, 0]);
  }

  var roundKeyCount = (rounds + 1) * 4;
  var KC = this.key.length / 4;

  // convert the key into ints
  var tk = convertToInt32(this.key);

  // copy values into round key arrays
  var index;
  for (var i = 0; i < KC; i++) {
    index = i >> 2;
    this._Ke[index][i % 4] = tk[i];
    this._Kd[rounds - index][i % 4] = tk[i];
  }

  // key expansion (fips-197 section 5.2)
  var rconpointer = 0;
  var t = KC, tt;
  while (t < roundKeyCount) {
    tt = tk[KC - 1];
    tk[0] ^= ((S[(tt >> 16) & 0xFF] << 24) ^
      (S[(tt >> 8) & 0xFF] << 16) ^
      (S[tt & 0xFF] << 8) ^
      S[(tt >> 24) & 0xFF] ^
      (rcon[rconpointer] << 24));
    rconpointer += 1;

    // key expansion (for non-256 bit)
    if (KC != 8) {
      for (var i = 1; i < KC; i++) {
        tk[i] ^= tk[i - 1];
      }

      // key expansion for 256-bit keys is "slightly different" (fips-197)
    } else {
      for (var i = 1; i < (KC / 2); i++) {
        tk[i] ^= tk[i - 1];
      }
      tt = tk[(KC / 2) - 1];

      tk[KC / 2] ^= (S[tt & 0xFF] ^
        (S[(tt >> 8) & 0xFF] << 8) ^
        (S[(tt >> 16) & 0xFF] << 16) ^
        (S[(tt >> 24) & 0xFF] << 24));

      for (var i = (KC / 2) + 1; i < KC; i++) {
        tk[i] ^= tk[i - 1];
      }
    }

    // copy values into round key arrays
    var i = 0, r, c;
    while (i < KC && t < roundKeyCount) {
      r = t >> 2;
      c = t % 4;
      this._Ke[r][c] = tk[i];
      this._Kd[rounds - r][c] = tk[i++];
      t++;
    }
  }

  // inverse-cipher-ify the decryption round key (fips-197 section 5.3)
  for (var r = 1; r < rounds; r++) {
    for (var c = 0; c < 4; c++) {
      tt = this._Kd[r][c];
      this._Kd[r][c] = (U1[(tt >> 24) & 0xFF] ^
        U2[(tt >> 16) & 0xFF] ^
        U3[(tt >> 8) & 0xFF] ^
        U4[tt & 0xFF]);
    }
  }
}

AES.prototype.encrypt = function (plaintext) {
  if (plaintext.length != 16) {
    throw new Error('invalid plaintext size (must be 16 bytes)');
  }

  var rounds = this._Ke.length - 1;
  var a = [0, 0, 0, 0];

  // convert plaintext to (ints ^ key)
  var t = convertToInt32(plaintext);
  for (var i = 0; i < 4; i++) {
    t[i] ^= this._Ke[0][i];
  }

  // apply round transforms
  for (var r = 1; r < rounds; r++) {
    for (var i = 0; i < 4; i++) {
      a[i] = (T1[(t[i] >> 24) & 0xff] ^
        T2[(t[(i + 1) % 4] >> 16) & 0xff] ^
        T3[(t[(i + 2) % 4] >> 8) & 0xff] ^
        T4[t[(i + 3) % 4] & 0xff] ^
        this._Ke[r][i]);
    }
    t = a.slice();
  }

  // the last round is special
  var result = createArray(16), tt;
  for (var i = 0; i < 4; i++) {
    tt = this._Ke[rounds][i];
    result[4 * i] = (S[(t[i] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
    result[4 * i + 1] = (S[(t[(i + 1) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
    result[4 * i + 2] = (S[(t[(i + 2) % 4] >> 8) & 0xff] ^ (tt >> 8)) & 0xff;
    result[4 * i + 3] = (S[t[(i + 3) % 4] & 0xff] ^ tt) & 0xff;
  }

  return result;
}

AES.prototype.decrypt = function (ciphertext) {
  if (ciphertext.length != 16) {
    throw new Error('invalid ciphertext size (must be 16 bytes)');
  }

  var rounds = this._Kd.length - 1;
  var a = [0, 0, 0, 0];

  // convert plaintext to (ints ^ key)
  var t = convertToInt32(ciphertext);
  for (var i = 0; i < 4; i++) {
    t[i] ^= this._Kd[0][i];
  }

  // apply round transforms
  for (var r = 1; r < rounds; r++) {
    for (var i = 0; i < 4; i++) {
      a[i] = (T5[(t[i] >> 24) & 0xff] ^
        T6[(t[(i + 3) % 4] >> 16) & 0xff] ^
        T7[(t[(i + 2) % 4] >> 8) & 0xff] ^
        T8[t[(i + 1) % 4] & 0xff] ^
        this._Kd[r][i]);
    }
    t = a.slice();
  }

  // the last round is special
  var result = createArray(16), tt;
  for (var i = 0; i < 4; i++) {
    tt = this._Kd[rounds][i];
    result[4 * i] = (Si[(t[i] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
    result[4 * i + 1] = (Si[(t[(i + 3) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
    result[4 * i + 2] = (Si[(t[(i + 2) % 4] >> 8) & 0xff] ^ (tt >> 8)) & 0xff;
    result[4 * i + 3] = (Si[t[(i + 1) % 4] & 0xff] ^ tt) & 0xff;
  }

  return result;
}


/**
 *  Mode Of Operation - Electonic Codebook (ECB)
 */
var ModeOfOperationECB = function (key) {
  if (!(this instanceof ModeOfOperationECB)) {
    throw Error('AES must be instanitated with `new`');
  }

  this.description = "Electronic Code Block";
  this.name = "ecb";

  this._aes = new AES(key);
}

ModeOfOperationECB.prototype.encrypt = function (plaintext) {
  plaintext = coerceArray(plaintext);

  if ((plaintext.length % 16) !== 0) {
    throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
  }

  var ciphertext = createArray(plaintext.length);
  var block = createArray(16);

  for (var i = 0; i < plaintext.length; i += 16) {
    copyArray(plaintext, block, 0, i, i + 16);
    block = this._aes.encrypt(block);
    copyArray(block, ciphertext, i);
  }

  return ciphertext;
}

ModeOfOperationECB.prototype.decrypt = function (ciphertext) {
  ciphertext = coerceArray(ciphertext);

  if ((ciphertext.length % 16) !== 0) {
    throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
  }

  var plaintext = createArray(ciphertext.length);
  var block = createArray(16);

  for (var i = 0; i < ciphertext.length; i += 16) {
    copyArray(ciphertext, block, 0, i, i + 16);
    block = this._aes.decrypt(block);
    copyArray(block, plaintext, i);
  }

  return plaintext;
}


/**
 *  Mode Of Operation - Cipher Block Chaining (CBC)
 */
var ModeOfOperationCBC = function (key, iv) {
  if (!(this instanceof ModeOfOperationCBC)) {
    throw Error('AES must be instanitated with `new`');
  }

  this.description = "Cipher Block Chaining";
  this.name = "cbc";

  if (!iv) {
    iv = createArray(16);

  } else if (iv.length != 16) {
    throw new Error('invalid initialation vector size (must be 16 bytes)');
  }

  this._lastCipherblock = coerceArray(iv, true);

  this._aes = new AES(key);
}

ModeOfOperationCBC.prototype.encrypt = function (plaintext) {
  plaintext = coerceArray(plaintext);

  if ((plaintext.length % 16) !== 0) {
    throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
  }

  var ciphertext = createArray(plaintext.length);
  var block = createArray(16);

  for (var i = 0; i < plaintext.length; i += 16) {
    copyArray(plaintext, block, 0, i, i + 16);

    for (var j = 0; j < 16; j++) {
      block[j] ^= this._lastCipherblock[j];
    }

    this._lastCipherblock = this._aes.encrypt(block);
    copyArray(this._lastCipherblock, ciphertext, i);
  }

  return ciphertext;
}

ModeOfOperationCBC.prototype.decrypt = function (ciphertext) {
  ciphertext = coerceArray(ciphertext);

  if ((ciphertext.length % 16) !== 0) {
    throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
  }

  var plaintext = createArray(ciphertext.length);
  var block = createArray(16);

  for (var i = 0; i < ciphertext.length; i += 16) {
    copyArray(ciphertext, block, 0, i, i + 16);
    block = this._aes.decrypt(block);

    for (var j = 0; j < 16; j++) {
      plaintext[i + j] = block[j] ^ this._lastCipherblock[j];
    }

    copyArray(ciphertext, this._lastCipherblock, 0, i, i + 16);
  }

  return plaintext;
}


/**
 *  Mode Of Operation - Cipher Feedback (CFB)
 */
var ModeOfOperationCFB = function (key, iv, segmentSize) {
  if (!(this instanceof ModeOfOperationCFB)) {
    throw Error('AES must be instanitated with `new`');
  }

  this.description = "Cipher Feedback";
  this.name = "cfb";

  if (!iv) {
    iv = createArray(16);

  } else if (iv.length != 16) {
    throw new Error('invalid initialation vector size (must be 16 size)');
  }

  if (!segmentSize) { segmentSize = 1; }

  this.segmentSize = segmentSize;

  this._shiftRegister = coerceArray(iv, true);

  this._aes = new AES(key);
}

ModeOfOperationCFB.prototype.encrypt = function (plaintext) {
  if ((plaintext.length % this.segmentSize) != 0) {
    throw new Error('invalid plaintext size (must be segmentSize bytes)');
  }

  var encrypted = coerceArray(plaintext, true);

  var xorSegment;
  for (var i = 0; i < encrypted.length; i += this.segmentSize) {
    xorSegment = this._aes.encrypt(this._shiftRegister);
    for (var j = 0; j < this.segmentSize; j++) {
      encrypted[i + j] ^= xorSegment[j];
    }

    // Shift the register
    copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
    copyArray(encrypted, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
  }

  return encrypted;
}

ModeOfOperationCFB.prototype.decrypt = function (ciphertext) {
  if ((ciphertext.length % this.segmentSize) != 0) {
    throw new Error('invalid ciphertext size (must be segmentSize bytes)');
  }

  var plaintext = coerceArray(ciphertext, true);

  var xorSegment;
  for (var i = 0; i < plaintext.length; i += this.segmentSize) {
    xorSegment = this._aes.encrypt(this._shiftRegister);

    for (var j = 0; j < this.segmentSize; j++) {
      plaintext[i + j] ^= xorSegment[j];
    }

    // Shift the register
    copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
    copyArray(ciphertext, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
  }

  return plaintext;
}

/**
 *  Mode Of Operation - Output Feedback (OFB)
 */
var ModeOfOperationOFB = function (key, iv) {
  if (!(this instanceof ModeOfOperationOFB)) {
    throw Error('AES must be instanitated with `new`');
  }

  this.description = "Output Feedback";
  this.name = "ofb";

  if (!iv) {
    iv = createArray(16);

  } else if (iv.length != 16) {
    throw new Error('invalid initialation vector size (must be 16 bytes)');
  }

  this._lastPrecipher = coerceArray(iv, true);
  this._lastPrecipherIndex = 16;

  this._aes = new AES(key);
}

ModeOfOperationOFB.prototype.encrypt = function (plaintext) {
  var encrypted = coerceArray(plaintext, true);

  for (var i = 0; i < encrypted.length; i++) {
    if (this._lastPrecipherIndex === 16) {
      this._lastPrecipher = this._aes.encrypt(this._lastPrecipher);
      this._lastPrecipherIndex = 0;
    }
    encrypted[i] ^= this._lastPrecipher[this._lastPrecipherIndex++];
  }

  return encrypted;
}

// Decryption is symetric
ModeOfOperationOFB.prototype.decrypt = ModeOfOperationOFB.prototype.encrypt;


/**
 *  Counter object for CTR common mode of operation
 */
var Counter = function (initialValue) {
  if (!(this instanceof Counter)) {
    throw Error('Counter must be instanitated with `new`');
  }

  // We allow 0, but anything false-ish uses the default 1
  if (initialValue !== 0 && !initialValue) { initialValue = 1; }

  if (typeof (initialValue) === 'number') {
    this._counter = createArray(16);
    this.setValue(initialValue);

  } else {
    this.setBytes(initialValue);
  }
}

Counter.prototype.setValue = function (value) {
  if (typeof (value) !== 'number' || parseInt(value) != value) {
    throw new Error('invalid counter value (must be an integer)');
  }

  // We cannot safely handle numbers beyond the safe range for integers
  if (value > Number.MAX_SAFE_INTEGER) {
    throw new Error('integer value out of safe range');
  }

  for (var index = 15; index >= 0; --index) {
    this._counter[index] = value % 256;
    value = parseInt(value / 256);
  }
}

Counter.prototype.setBytes = function (bytes) {
  bytes = coerceArray(bytes, true);

  if (bytes.length != 16) {
    throw new Error('invalid counter bytes size (must be 16 bytes)');
  }

  this._counter = bytes;
};

Counter.prototype.increment = function () {
  for (var i = 15; i >= 0; i--) {
    if (this._counter[i] === 255) {
      this._counter[i] = 0;
    } else {
      this._counter[i]++;
      break;
    }
  }
}


/**
 *  Mode Of Operation - Counter (CTR)
 */
var ModeOfOperationCTR = function (key, counter) {
  if (!(this instanceof ModeOfOperationCTR)) {
    throw Error('AES must be instanitated with `new`');
  }

  this.description = "Counter";
  this.name = "ctr";

  if (!(counter instanceof Counter)) {
    counter = new Counter(counter)
  }

  this._counter = counter;

  this._remainingCounter = null;
  this._remainingCounterIndex = 16;

  this._aes = new AES(key);
}

ModeOfOperationCTR.prototype.encrypt = function (plaintext) {
  var encrypted = coerceArray(plaintext, true);

  for (var i = 0; i < encrypted.length; i++) {
    if (this._remainingCounterIndex === 16) {
      this._remainingCounter = this._aes.encrypt(this._counter._counter);
      this._remainingCounterIndex = 0;
      this._counter.increment();
    }
    encrypted[i] ^= this._remainingCounter[this._remainingCounterIndex++];
  }

  return encrypted;
}

// Decryption is symetric
ModeOfOperationCTR.prototype.decrypt = ModeOfOperationCTR.prototype.encrypt;


///////////////////////
// Padding

// See:https://tools.ietf.org/html/rfc2315
function pkcs7pad(data) {
  data = coerceArray(data, true);
  var padder = 16 - (data.length % 16);
  var result = createArray(data.length + padder);
  copyArray(data, result);
  for (var i = data.length; i < result.length; i++) {
    result[i] = padder;
  }
  return result;
}

function pkcs7strip(data) {
  data = coerceArray(data, true);
  if (data.length < 16) { throw new Error('PKCS#7 invalid length'); }

  var padder = data[data.length - 1];
  if (padder > 16) { throw new Error('PKCS#7 padding byte out of range'); }

  var length = data.length - padder;
  for (var i = 0; i < padder; i++) {
    if (data[length + i] !== padder) {
      throw new Error('PKCS#7 invalid padding byte');
    }
  }

  var result = createArray(length);
  copyArray(data, result, 0, 0, length);
  return result;
}

///////////////////////
// Exporting


// The block cipher
var aesjs = {
  AES: AES,
  Counter: Counter,

  ModeOfOperation: {
    ecb: ModeOfOperationECB,
    cbc: ModeOfOperationCBC,
    cfb: ModeOfOperationCFB,
    ofb: ModeOfOperationOFB,
    ctr: ModeOfOperationCTR
  },

  utils: {
    hex: convertHex,
    utf8: convertUtf8
  },

  padding: {
    pkcs7: {
      pad: pkcs7pad,
      strip: pkcs7strip
    }
  },

  _arrayTest: {
    coerceArray: coerceArray,
    createArray: createArray,
    copyArray: copyArray,
  }
};


/* aesjs end*/

/*rsa start */
var navigator2 = {
  appName: 'Netscape',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
};

var window2 = {
  ASN1: null,
  Base64: null,
  Hex: null,
  crypto: null,
  href: null
};

var KJUR = null;


var CryptoJS = CryptoJS || (function (e, g) {
  var a = {};
  var b = a.lib = {};
  var j = b.Base = (function () {
    function n() { }
    return {
      extend: function (p) {
        n.prototype = this;
        var o = new n();
        if (p) {
          o.mixIn(p)
        }
        if (!o.hasOwnProperty("init")) {
          o.init = function () {
            o.$super.init.apply(this, arguments)
          }
        }
        o.init.prototype = o;
        o.$super = this;
        return o
      },
      create: function () {
        var o = this.extend();
        o.init.apply(o, arguments);
        return o
      },
      init: function () { },
      mixIn: function (p) {
        for (var o in p) {
          if (p.hasOwnProperty(o)) {
            this[o] = p[o]
          }
        }
        if (p.hasOwnProperty("toString")) {
          this.toString = p.toString
        }
      },
      clone: function () {
        return this.init.prototype.extend(this)
      }
    }
  }());
  var l = b.WordArray = j.extend({
    init: function (o, n) {
      o = this.words = o || [];
      if (n != g) {
        this.sigBytes = n
      } else {
        this.sigBytes = o.length * 4
      }
    },
    toString: function (n) {
      return (n || h).stringify(this)
    },
    concat: function (t) {
      var q = this.words;
      var p = t.words;
      var n = this.sigBytes;
      var s = t.sigBytes;
      this.clamp();
      if (n % 4) {
        for (var r = 0; r < s; r++) {
          var o = (p[r >>> 2] >>> (24 - (r % 4) * 8)) & 255;
          q[(n + r) >>> 2] |= o << (24 - ((n + r) % 4) * 8)
        }
      } else {
        for (var r = 0; r < s; r += 4) {
          q[(n + r) >>> 2] = p[r >>> 2]
        }
      }
      this.sigBytes += s;
      return this
    },
    clamp: function () {
      var o = this.words;
      var n = this.sigBytes;
      o[n >>> 2] &= 4294967295 << (32 - (n % 4) * 8);
      o.length = e.ceil(n / 4)
    },
    clone: function () {
      var n = j.clone.call(this);
      n.words = this.words.slice(0);
      return n
    },
    random: function (p) {
      var o = [];
      for (var n = 0; n < p; n += 4) {
        o.push((e.random() * 4294967296) | 0)
      }
      return new l.init(o, p)
    }
  });
  var m = a.enc = {};
  var h = m.Hex = {
    stringify: function (p) {
      var r = p.words;
      var o = p.sigBytes;
      var q = [];
      for (var n = 0; n < o; n++) {
        var s = (r[n >>> 2] >>> (24 - (n % 4) * 8)) & 255;
        q.push((s >>> 4).toString(16));
        q.push((s & 15).toString(16))
      }
      return q.join("")
    },
    parse: function (p) {
      var n = p.length;
      var q = [];
      for (var o = 0; o < n; o += 2) {
        q[o >>> 3] |= parseInt(p.substr(o, 2), 16) << (24 - (o % 8) * 4)
      }
      return new l.init(q, n / 2)
    }
  };
  var d = m.Latin1 = {
    stringify: function (q) {
      var r = q.words;
      var p = q.sigBytes;
      var n = [];
      for (var o = 0; o < p; o++) {
        var s = (r[o >>> 2] >>> (24 - (o % 4) * 8)) & 255;
        n.push(String.fromCharCode(s))
      }
      return n.join("")
    },
    parse: function (p) {
      var n = p.length;
      var q = [];
      for (var o = 0; o < n; o++) {
        q[o >>> 2] |= (p.charCodeAt(o) & 255) << (24 - (o % 4) * 8)
      }
      return new l.init(q, n)
    }
  };
  var c = m.Utf8 = {
    stringify: function (n) {
      try {
        return decodeURIComponent(escape(d.stringify(n)))
      } catch (o) {
        throw new Error("Malformed UTF-8 data")
      }
    },
    parse: function (n) {
      return d.parse(unescape(encodeURIComponent(n)))
    }
  };
  var i = b.BufferedBlockAlgorithm = j.extend({
    reset: function () {
      this._data = new l.init();
      this._nDataBytes = 0
    },
    _append: function (n) {
      if (typeof n == "string") {
        n = c.parse(n)
      }
      this._data.concat(n);
      this._nDataBytes += n.sigBytes
    },
    _process: function (w) {
      var q = this._data;
      var x = q.words;
      var n = q.sigBytes;
      var t = this.blockSize;
      var v = t * 4;
      var u = n / v;
      if (w) {
        u = e.ceil(u)
      } else {
        u = e.max((u | 0) - this._minBufferSize, 0)
      }
      var s = u * t;
      var r = e.min(s * 4, n);
      if (s) {
        for (var p = 0; p < s; p += t) {
          this._doProcessBlock(x, p)
        }
        var o = x.splice(0, s);
        q.sigBytes -= r
      }
      return new l.init(o, r)
    },
    clone: function () {
      var n = j.clone.call(this);
      n._data = this._data.clone();
      return n
    },
    _minBufferSize: 0
  });
  var f = b.Hasher = i.extend({
    cfg: j.extend(),
    init: function (n) {
      this.cfg = this.cfg.extend(n);
      this.reset()
    },
    reset: function () {
      i.reset.call(this);
      this._doReset()
    },
    update: function (n) {
      this._append(n);
      this._process();
      return this
    },
    finalize: function (n) {
      if (n) {
        this._append(n)
      }
      var o = this._doFinalize();
      return o
    },
    blockSize: 512 / 32,
    _createHelper: function (n) {
      return function (p, o) {
        return new n.init(o).finalize(p)
      }
    },
    _createHmacHelper: function (n) {
      return function (p, o) {
        return new k.HMAC.init(n, o).finalize(p)
      }
    }
  });
  var k = a.algo = {};
  return a
}(Math));

(function (g) {
  var a = CryptoJS,
    f = a.lib,
    e = f.Base,
    h = f.WordArray,
    a = a.x64 = {};
  a.Word = e.extend({
    init: function (b, c) {
      this.high = b;
      this.low = c
    }
  });
  a.WordArray = e.extend({
    init: function (b, c) {
      b = this.words = b || [];
      this.sigBytes = c != g ? c : 8 * b.length
    },
    toX32: function () {
      for (var b = this.words,
        c = b.length,
        a = [], d = 0; d < c; d++) {
        var e = b[d];
        a.push(e.high);
        a.push(e.low)
      }
      return h.create(a, this.sigBytes)
    },
    clone: function () {
      for (var b = e.clone.call(this), c = b.words = this.words.slice(0), a = c.length, d = 0; d < a; d++) c[d] = c[d].clone();
      return b
    }
  })
})();

CryptoJS.lib.Cipher ||
  function (u) {
    var g = CryptoJS,
      f = g.lib,
      k = f.Base,
      l = f.WordArray,
      q = f.BufferedBlockAlgorithm,
      r = g.enc.Base64,
      v = g.algo.EvpKDF,
      n = f.Cipher = q.extend({
        cfg: k.extend(),
        createEncryptor: function (a, b) {
          return this.create(this._ENC_XFORM_MODE, a, b)
        },
        createDecryptor: function (a, b) {
          return this.create(this._DEC_XFORM_MODE, a, b)
        },
        init: function (a, b, c) {
          this.cfg = this.cfg.extend(c);
          this._xformMode = a;
          this._key = b;
          this.reset()
        },
        reset: function () {
          q.reset.call(this);
          this._doReset()
        },
        process: function (a) {
          this._append(a);
          return this._process()
        },
        finalize: function (a) {
          a && this._append(a);
          return this._doFinalize()
        },
        keySize: 4,
        ivSize: 4,
        _ENC_XFORM_MODE: 1,
        _DEC_XFORM_MODE: 2,
        _createHelper: function (a) {
          return {
            encrypt: function (b, c, d) {
              return ("string" == typeof c ? s : j).encrypt(a, b, c, d)
            },
            decrypt: function (b, c, d) {
              return ("string" == typeof c ? s : j).decrypt(a, b, c, d)
            }
          }
        }
      });
    f.StreamCipher = n.extend({
      _doFinalize: function () {
        return this._process(!0)
      },
      blockSize: 1
    });
    var m = g.mode = {},
      t = function (a, b, c) {
        var d = this._iv;
        d ? this._iv = u : d = this._prevBlock;
        for (var e = 0; e < c; e++) a[b + e] ^= d[e]
      },
      h = (f.BlockCipherMode = k.extend({
        createEncryptor: function (a, b) {
          return this.Encryptor.create(a, b)
        },
        createDecryptor: function (a, b) {
          return this.Decryptor.create(a, b)
        },
        init: function (a, b) {
          this._cipher = a;
          this._iv = b
        }
      })).extend();
    h.Encryptor = h.extend({
      processBlock: function (a, b) {
        var c = this._cipher,
          d = c.blockSize;
        t.call(this, a, b, d);
        c.encryptBlock(a, b);
        this._prevBlock = a.slice(b, b + d)
      }
    });
    h.Decryptor = h.extend({
      processBlock: function (a, b) {
        var c = this._cipher,
          d = c.blockSize,
          e = a.slice(b, b + d);
        c.decryptBlock(a, b);
        t.call(this, a, b, d);
        this._prevBlock = e
      }
    });
    m = m.CBC = h;
    h = (g.pad = {}).Pkcs7 = {
      pad: function (a, b) {
        for (var c = 4 * b,
          c = c - a.sigBytes % c,
          d = c << 24 | c << 16 | c << 8 | c,
          e = [], f = 0; f < c; f += 4) e.push(d);
        c = l.create(e, c);
        a.concat(c)
      },
      unpad: function (a) {
        a.sigBytes -= a.words[a.sigBytes - 1 >>> 2] & 255
      }
    };
    f.BlockCipher = n.extend({
      cfg: n.cfg.extend({
        mode: m,
        padding: h
      }),
      reset: function () {
        n.reset.call(this);
        var a = this.cfg,
          b = a.iv,
          a = a.mode;
        if (this._xformMode == this._ENC_XFORM_MODE) var c = a.createEncryptor;
        else c = a.createDecryptor,
          this._minBufferSize = 1;
        this._mode = c.call(a, this, b && b.words)
      },
      _doProcessBlock: function (a, b) {
        this._mode.processBlock(a, b)
      },
      _doFinalize: function () {
        var a = this.cfg.padding;
        if (this._xformMode == this._ENC_XFORM_MODE) {
          a.pad(this._data, this.blockSize);
          var b = this._process(!0)
        } else b = this._process(!0),
          a.unpad(b);
        return b
      },
      blockSize: 4
    });
    var p = f.CipherParams = k.extend({
      init: function (a) {
        this.mixIn(a)
      },
      toString: function (a) {
        return (a || this.formatter).stringify(this)
      }
    }),
      m = (g.format = {}).OpenSSL = {
        stringify: function (a) {
          var b = a.ciphertext;
          a = a.salt;
          return (a ? l.create([1398893684, 1701076831]).concat(a).concat(b) : b).toString(r)
        },
        parse: function (a) {
          a = r.parse(a);
          var b = a.words;
          if (1398893684 == b[0] && 1701076831 == b[1]) {
            var c = l.create(b.slice(2, 4));
            b.splice(0, 4);
            a.sigBytes -= 16
          }
          return p.create({
            ciphertext: a,
            salt: c
          })
        }
      },
      j = f.SerializableCipher = k.extend({
        cfg: k.extend({
          format: m
        }),
        encrypt: function (a, b, c, d) {
          d = this.cfg.extend(d);
          var e = a.createEncryptor(c, d);
          b = e.finalize(b);
          e = e.cfg;
          return p.create({
            ciphertext: b,
            key: c,
            iv: e.iv,
            algorithm: a,
            mode: e.mode,
            padding: e.padding,
            blockSize: a.blockSize,
            formatter: d.format
          })
        },
        decrypt: function (a, b, c, d) {
          d = this.cfg.extend(d);
          b = this._parse(b, d.format);
          return a.createDecryptor(c, d).finalize(b.ciphertext)
        },
        _parse: function (a, b) {
          return "string" == typeof a ? b.parse(a, this) : a
        }
      }),
      g = (g.kdf = {}).OpenSSL = {
        execute: function (a, b, c, d) {
          d || (d = l.random(8));
          a = v.create({
            keySize: b + c
          }).compute(a, d);
          c = l.create(a.words.slice(b), 4 * c);
          a.sigBytes = 4 * b;
          return p.create({
            key: a,
            iv: c,
            salt: d
          })
        }
      },
      s = f.PasswordBasedCipher = j.extend({
        cfg: j.cfg.extend({
          kdf: g
        }),
        encrypt: function (a, b, c, d) {
          d = this.cfg.extend(d);
          c = d.kdf.execute(c, a.keySize, a.ivSize);
          d.iv = c.iv;
          a = j.encrypt.call(this, a, b, c.key, d);
          a.mixIn(c);
          return a
        },
        decrypt: function (a, b, c, d) {
          d = this.cfg.extend(d);
          b = this._parse(b, d.format);
          c = d.kdf.execute(c, a.keySize, a.ivSize, b.salt);
          d.iv = c.iv;
          return j.decrypt.call(this, a, b, c.key, d)
        }
      })
  }();

(function () {
  for (var q = CryptoJS,
    x = q.lib.BlockCipher,
    r = q.algo,
    j = [], y = [], z = [], A = [], B = [], C = [], s = [], u = [], v = [], w = [], g = [], k = 0; 256 > k; k++) g[k] = 128 > k ? k << 1 : k << 1 ^ 283;
  for (var n = 0,
    l = 0,
    k = 0; 256 > k; k++) {
    var f = l ^ l << 1 ^ l << 2 ^ l << 3 ^ l << 4,
      f = f >>> 8 ^ f & 255 ^ 99;
    j[n] = f;
    y[f] = n;
    var t = g[n],
      D = g[t],
      E = g[D],
      b = 257 * g[f] ^ 16843008 * f;
    z[n] = b << 24 | b >>> 8;
    A[n] = b << 16 | b >>> 16;
    B[n] = b << 8 | b >>> 24;
    C[n] = b;
    b = 16843009 * E ^ 65537 * D ^ 257 * t ^ 16843008 * n;
    s[f] = b << 24 | b >>> 8;
    u[f] = b << 16 | b >>> 16;
    v[f] = b << 8 | b >>> 24;
    w[f] = b;
    n ? (n = t ^ g[g[g[E ^ t]]], l ^= g[g[l]]) : n = l = 1
  }
  var F = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54],
    r = r.AES = x.extend({
      _doReset: function () {
        for (var c = this._key,
          e = c.words,
          a = c.sigBytes / 4,
          c = 4 * ((this._nRounds = a + 6) + 1), b = this._keySchedule = [], h = 0; h < c; h++) if (h < a) b[h] = e[h];
          else {
            var d = b[h - 1];
            h % a ? 6 < a && 4 == h % a && (d = j[d >>> 24] << 24 | j[d >>> 16 & 255] << 16 | j[d >>> 8 & 255] << 8 | j[d & 255]) : (d = d << 8 | d >>> 24, d = j[d >>> 24] << 24 | j[d >>> 16 & 255] << 16 | j[d >>> 8 & 255] << 8 | j[d & 255], d ^= F[h / a | 0] << 24);
            b[h] = b[h - a] ^ d
          }
        e = this._invKeySchedule = [];
        for (a = 0; a < c; a++) h = c - a,
          d = a % 4 ? b[h] : b[h - 4],
          e[a] = 4 > a || 4 >= h ? d : s[j[d >>> 24]] ^ u[j[d >>> 16 & 255]] ^ v[j[d >>> 8 & 255]] ^ w[j[d & 255]]
      },
      encryptBlock: function (c, e) {
        this._doCryptBlock(c, e, this._keySchedule, z, A, B, C, j)
      },
      decryptBlock: function (c, e) {
        var a = c[e + 1];
        c[e + 1] = c[e + 3];
        c[e + 3] = a;
        this._doCryptBlock(c, e, this._invKeySchedule, s, u, v, w, y);
        a = c[e + 1];
        c[e + 1] = c[e + 3];
        c[e + 3] = a
      },
      _doCryptBlock: function (c, e, a, b, h, d, j, m) {
        for (var n = this._nRounds,
          f = c[e] ^ a[0], g = c[e + 1] ^ a[1], k = c[e + 2] ^ a[2], p = c[e + 3] ^ a[3], l = 4, t = 1; t < n; t++) var q = b[f >>> 24] ^ h[g >>> 16 & 255] ^ d[k >>> 8 & 255] ^ j[p & 255] ^ a[l++],
            r = b[g >>> 24] ^ h[k >>> 16 & 255] ^ d[p >>> 8 & 255] ^ j[f & 255] ^ a[l++],
            s = b[k >>> 24] ^ h[p >>> 16 & 255] ^ d[f >>> 8 & 255] ^ j[g & 255] ^ a[l++],
            p = b[p >>> 24] ^ h[f >>> 16 & 255] ^ d[g >>> 8 & 255] ^ j[k & 255] ^ a[l++],
            f = q,
            g = r,
            k = s;
        q = (m[f >>> 24] << 24 | m[g >>> 16 & 255] << 16 | m[k >>> 8 & 255] << 8 | m[p & 255]) ^ a[l++];
        r = (m[g >>> 24] << 24 | m[k >>> 16 & 255] << 16 | m[p >>> 8 & 255] << 8 | m[f & 255]) ^ a[l++];
        s = (m[k >>> 24] << 24 | m[p >>> 16 & 255] << 16 | m[f >>> 8 & 255] << 8 | m[g & 255]) ^ a[l++];
        p = (m[p >>> 24] << 24 | m[f >>> 16 & 255] << 16 | m[g >>> 8 & 255] << 8 | m[k & 255]) ^ a[l++];
        c[e] = q;
        c[e + 1] = r;
        c[e + 2] = s;
        c[e + 3] = p
      },
      keySize: 8
    });
  q.AES = x._createHelper(r)
})();

(function () {
  function j(b, c) {
    var a = (this._lBlock >>> b ^ this._rBlock) & c;
    this._rBlock ^= a;
    this._lBlock ^= a << b
  }
  function l(b, c) {
    var a = (this._rBlock >>> b ^ this._lBlock) & c;
    this._lBlock ^= a;
    this._rBlock ^= a << b
  }
  var h = CryptoJS,
    e = h.lib,
    n = e.WordArray,
    e = e.BlockCipher,
    g = h.algo,
    q = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4],
    p = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32],
    r = [1, 2, 4, 6, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28],
    s = [{
      "0": 8421888,
      268435456: 32768,
      536870912: 8421378,
      805306368: 2,
      1073741824: 512,
      1342177280: 8421890,
      1610612736: 8389122,
      1879048192: 8388608,
      2147483648: 514,
      2415919104: 8389120,
      2684354560: 33280,
      2952790016: 8421376,
      3221225472: 32770,
      3489660928: 8388610,
      3758096384: 0,
      4026531840: 33282,
      134217728: 0,
      402653184: 8421890,
      671088640: 33282,
      939524096: 32768,
      1207959552: 8421888,
      1476395008: 512,
      1744830464: 8421378,
      2013265920: 2,
      2281701376: 8389120,
      2550136832: 33280,
      2818572288: 8421376,
      3087007744: 8389122,
      3355443200: 8388610,
      3623878656: 32770,
      3892314112: 514,
      4160749568: 8388608,
      1: 32768,
      268435457: 2,
      536870913: 8421888,
      805306369: 8388608,
      1073741825: 8421378,
      1342177281: 33280,
      1610612737: 512,
      1879048193: 8389122,
      2147483649: 8421890,
      2415919105: 8421376,
      2684354561: 8388610,
      2952790017: 33282,
      3221225473: 514,
      3489660929: 8389120,
      3758096385: 32770,
      4026531841: 0,
      134217729: 8421890,
      402653185: 8421376,
      671088641: 8388608,
      939524097: 512,
      1207959553: 32768,
      1476395009: 8388610,
      1744830465: 2,
      2013265921: 33282,
      2281701377: 32770,
      2550136833: 8389122,
      2818572289: 514,
      3087007745: 8421888,
      3355443201: 8389120,
      3623878657: 0,
      3892314113: 33280,
      4160749569: 8421378
    },
    {
      "0": 1074282512,
      16777216: 16384,
      33554432: 524288,
      50331648: 1074266128,
      67108864: 1073741840,
      83886080: 1074282496,
      100663296: 1073758208,
      117440512: 16,
      134217728: 540672,
      150994944: 1073758224,
      167772160: 1073741824,
      184549376: 540688,
      201326592: 524304,
      218103808: 0,
      234881024: 16400,
      251658240: 1074266112,
      8388608: 1073758208,
      25165824: 540688,
      41943040: 16,
      58720256: 1073758224,
      75497472: 1074282512,
      92274688: 1073741824,
      109051904: 524288,
      125829120: 1074266128,
      142606336: 524304,
      159383552: 0,
      176160768: 16384,
      192937984: 1074266112,
      209715200: 1073741840,
      226492416: 540672,
      243269632: 1074282496,
      260046848: 16400,
      268435456: 0,
      285212672: 1074266128,
      301989888: 1073758224,
      318767104: 1074282496,
      335544320: 1074266112,
      352321536: 16,
      369098752: 540688,
      385875968: 16384,
      402653184: 16400,
      419430400: 524288,
      436207616: 524304,
      452984832: 1073741840,
      469762048: 540672,
      486539264: 1073758208,
      503316480: 1073741824,
      520093696: 1074282512,
      276824064: 540688,
      293601280: 524288,
      310378496: 1074266112,
      327155712: 16384,
      343932928: 1073758208,
      360710144: 1074282512,
      377487360: 16,
      394264576: 1073741824,
      411041792: 1074282496,
      427819008: 1073741840,
      444596224: 1073758224,
      461373440: 524304,
      478150656: 0,
      494927872: 16400,
      511705088: 1074266128,
      528482304: 540672
    },
    {
      "0": 260,
      1048576: 0,
      2097152: 67109120,
      3145728: 65796,
      4194304: 65540,
      5242880: 67108868,
      6291456: 67174660,
      7340032: 67174400,
      8388608: 67108864,
      9437184: 67174656,
      10485760: 65792,
      11534336: 67174404,
      12582912: 67109124,
      13631488: 65536,
      14680064: 4,
      15728640: 256,
      524288: 67174656,
      1572864: 67174404,
      2621440: 0,
      3670016: 67109120,
      4718592: 67108868,
      5767168: 65536,
      6815744: 65540,
      7864320: 260,
      8912896: 4,
      9961472: 256,
      11010048: 67174400,
      12058624: 65796,
      13107200: 65792,
      14155776: 67109124,
      15204352: 67174660,
      16252928: 67108864,
      16777216: 67174656,
      17825792: 65540,
      18874368: 65536,
      19922944: 67109120,
      20971520: 256,
      22020096: 67174660,
      23068672: 67108868,
      24117248: 0,
      25165824: 67109124,
      26214400: 67108864,
      27262976: 4,
      28311552: 65792,
      29360128: 67174400,
      30408704: 260,
      31457280: 65796,
      32505856: 67174404,
      17301504: 67108864,
      18350080: 260,
      19398656: 67174656,
      20447232: 0,
      21495808: 65540,
      22544384: 67109120,
      23592960: 256,
      24641536: 67174404,
      25690112: 65536,
      26738688: 67174660,
      27787264: 65796,
      28835840: 67108868,
      29884416: 67109124,
      30932992: 67174400,
      31981568: 4,
      33030144: 65792
    },
    {
      "0": 2151682048,
      65536: 2147487808,
      131072: 4198464,
      196608: 2151677952,
      262144: 0,
      327680: 4198400,
      393216: 2147483712,
      458752: 4194368,
      524288: 2147483648,
      589824: 4194304,
      655360: 64,
      720896: 2147487744,
      786432: 2151678016,
      851968: 4160,
      917504: 4096,
      983040: 2151682112,
      32768: 2147487808,
      98304: 64,
      163840: 2151678016,
      229376: 2147487744,
      294912: 4198400,
      360448: 2151682112,
      425984: 0,
      491520: 2151677952,
      557056: 4096,
      622592: 2151682048,
      688128: 4194304,
      753664: 4160,
      819200: 2147483648,
      884736: 4194368,
      950272: 4198464,
      1015808: 2147483712,
      1048576: 4194368,
      1114112: 4198400,
      1179648: 2147483712,
      1245184: 0,
      1310720: 4160,
      1376256: 2151678016,
      1441792: 2151682048,
      1507328: 2147487808,
      1572864: 2151682112,
      1638400: 2147483648,
      1703936: 2151677952,
      1769472: 4198464,
      1835008: 2147487744,
      1900544: 4194304,
      1966080: 64,
      2031616: 4096,
      1081344: 2151677952,
      1146880: 2151682112,
      1212416: 0,
      1277952: 4198400,
      1343488: 4194368,
      1409024: 2147483648,
      1474560: 2147487808,
      1540096: 64,
      1605632: 2147483712,
      1671168: 4096,
      1736704: 2147487744,
      1802240: 2151678016,
      1867776: 4160,
      1933312: 2151682048,
      1998848: 4194304,
      2064384: 4198464
    },
    {
      "0": 128,
      4096: 17039360,
      8192: 262144,
      12288: 536870912,
      16384: 537133184,
      20480: 16777344,
      24576: 553648256,
      28672: 262272,
      32768: 16777216,
      36864: 537133056,
      40960: 536871040,
      45056: 553910400,
      49152: 553910272,
      53248: 0,
      57344: 17039488,
      61440: 553648128,
      2048: 17039488,
      6144: 553648256,
      10240: 128,
      14336: 17039360,
      18432: 262144,
      22528: 537133184,
      26624: 553910272,
      30720: 536870912,
      34816: 537133056,
      38912: 0,
      43008: 553910400,
      47104: 16777344,
      51200: 536871040,
      55296: 553648128,
      59392: 16777216,
      63488: 262272,
      65536: 262144,
      69632: 128,
      73728: 536870912,
      77824: 553648256,
      81920: 16777344,
      86016: 553910272,
      90112: 537133184,
      94208: 16777216,
      98304: 553910400,
      102400: 553648128,
      106496: 17039360,
      110592: 537133056,
      114688: 262272,
      118784: 536871040,
      122880: 0,
      126976: 17039488,
      67584: 553648256,
      71680: 16777216,
      75776: 17039360,
      79872: 537133184,
      83968: 536870912,
      88064: 17039488,
      92160: 128,
      96256: 553910272,
      100352: 262272,
      104448: 553910400,
      108544: 0,
      112640: 553648128,
      116736: 16777344,
      120832: 262144,
      124928: 537133056,
      129024: 536871040
    },
    {
      "0": 268435464,
      256: 8192,
      512: 270532608,
      768: 270540808,
      1024: 268443648,
      1280: 2097152,
      1536: 2097160,
      1792: 268435456,
      2048: 0,
      2304: 268443656,
      2560: 2105344,
      2816: 8,
      3072: 270532616,
      3328: 2105352,
      3584: 8200,
      3840: 270540800,
      128: 270532608,
      384: 270540808,
      640: 8,
      896: 2097152,
      1152: 2105352,
      1408: 268435464,
      1664: 268443648,
      1920: 8200,
      2176: 2097160,
      2432: 8192,
      2688: 268443656,
      2944: 270532616,
      3200: 0,
      3456: 270540800,
      3712: 2105344,
      3968: 268435456,
      4096: 268443648,
      4352: 270532616,
      4608: 270540808,
      4864: 8200,
      5120: 2097152,
      5376: 268435456,
      5632: 268435464,
      5888: 2105344,
      6144: 2105352,
      6400: 0,
      6656: 8,
      6912: 270532608,
      7168: 8192,
      7424: 268443656,
      7680: 270540800,
      7936: 2097160,
      4224: 8,
      4480: 2105344,
      4736: 2097152,
      4992: 268435464,
      5248: 268443648,
      5504: 8200,
      5760: 270540808,
      6016: 270532608,
      6272: 270540800,
      6528: 270532616,
      6784: 8192,
      7040: 2105352,
      7296: 2097160,
      7552: 0,
      7808: 268435456,
      8064: 268443656
    },
    {
      "0": 1048576,
      16: 33555457,
      32: 1024,
      48: 1049601,
      64: 34604033,
      80: 0,
      96: 1,
      112: 34603009,
      128: 33555456,
      144: 1048577,
      160: 33554433,
      176: 34604032,
      192: 34603008,
      208: 1025,
      224: 1049600,
      240: 33554432,
      8: 34603009,
      24: 0,
      40: 33555457,
      56: 34604032,
      72: 1048576,
      88: 33554433,
      104: 33554432,
      120: 1025,
      136: 1049601,
      152: 33555456,
      168: 34603008,
      184: 1048577,
      200: 1024,
      216: 34604033,
      232: 1,
      248: 1049600,
      256: 33554432,
      272: 1048576,
      288: 33555457,
      304: 34603009,
      320: 1048577,
      336: 33555456,
      352: 34604032,
      368: 1049601,
      384: 1025,
      400: 34604033,
      416: 1049600,
      432: 1,
      448: 0,
      464: 34603008,
      480: 33554433,
      496: 1024,
      264: 1049600,
      280: 33555457,
      296: 34603009,
      312: 1,
      328: 33554432,
      344: 1048576,
      360: 1025,
      376: 34604032,
      392: 33554433,
      408: 34603008,
      424: 0,
      440: 34604033,
      456: 1049601,
      472: 1024,
      488: 33555456,
      504: 1048577
    },
    {
      "0": 134219808,
      1: 131072,
      2: 134217728,
      3: 32,
      4: 131104,
      5: 134350880,
      6: 134350848,
      7: 2048,
      8: 134348800,
      9: 134219776,
      10: 133120,
      11: 134348832,
      12: 2080,
      13: 0,
      14: 134217760,
      15: 133152,
      2147483648: 2048,
      2147483649: 134350880,
      2147483650: 134219808,
      2147483651: 134217728,
      2147483652: 134348800,
      2147483653: 133120,
      2147483654: 133152,
      2147483655: 32,
      2147483656: 134217760,
      2147483657: 2080,
      2147483658: 131104,
      2147483659: 134350848,
      2147483660: 0,
      2147483661: 134348832,
      2147483662: 134219776,
      2147483663: 131072,
      16: 133152,
      17: 134350848,
      18: 32,
      19: 2048,
      20: 134219776,
      21: 134217760,
      22: 134348832,
      23: 131072,
      24: 0,
      25: 131104,
      26: 134348800,
      27: 134219808,
      28: 134350880,
      29: 133120,
      30: 2080,
      31: 134217728,
      2147483664: 131072,
      2147483665: 2048,
      2147483666: 134348832,
      2147483667: 133152,
      2147483668: 32,
      2147483669: 134348800,
      2147483670: 134217728,
      2147483671: 134219808,
      2147483672: 134350880,
      2147483673: 134217760,
      2147483674: 134219776,
      2147483675: 0,
      2147483676: 133120,
      2147483677: 2080,
      2147483678: 131104,
      2147483679: 134350848
    }],
    t = [4160749569, 528482304, 33030144, 2064384, 129024, 8064, 504, 2147483679],
    m = g.DES = e.extend({
      _doReset: function () {
        for (var b = this._key.words,
          c = [], a = 0; 56 > a; a++) {
          var f = q[a] - 1;
          c[a] = b[f >>> 5] >>> 31 - f % 32 & 1
        }
        b = this._subKeys = [];
        for (f = 0; 16 > f; f++) {
          for (var d = b[f] = [], e = r[f], a = 0; 24 > a; a++) d[a / 6 | 0] |= c[(p[a] - 1 + e) % 28] << 31 - a % 6,
            d[4 + (a / 6 | 0)] |= c[28 + (p[a + 24] - 1 + e) % 28] << 31 - a % 6;
          d[0] = d[0] << 1 | d[0] >>> 31;
          for (a = 1; 7 > a; a++) d[a] >>>= 4 * (a - 1) + 3;
          d[7] = d[7] << 5 | d[7] >>> 27
        }
        c = this._invSubKeys = [];
        for (a = 0; 16 > a; a++) c[a] = b[15 - a]
      },
      encryptBlock: function (b, c) {
        this._doCryptBlock(b, c, this._subKeys)
      },
      decryptBlock: function (b, c) {
        this._doCryptBlock(b, c, this._invSubKeys)
      },
      _doCryptBlock: function (b, c, a) {
        this._lBlock = b[c];
        this._rBlock = b[c + 1];
        j.call(this, 4, 252645135);
        j.call(this, 16, 65535);
        l.call(this, 2, 858993459);
        l.call(this, 8, 16711935);
        j.call(this, 1, 1431655765);
        for (var f = 0; 16 > f; f++) {
          for (var d = a[f], e = this._lBlock, h = this._rBlock, g = 0, k = 0; 8 > k; k++) g |= s[k][((h ^ d[k]) & t[k]) >>> 0];
          this._lBlock = h;
          this._rBlock = e ^ g
        }
        a = this._lBlock;
        this._lBlock = this._rBlock;
        this._rBlock = a;
        j.call(this, 1, 1431655765);
        l.call(this, 8, 16711935);
        l.call(this, 2, 858993459);
        j.call(this, 16, 65535);
        j.call(this, 4, 252645135);
        b[c] = this._lBlock;
        b[c + 1] = this._rBlock
      },
      keySize: 2,
      ivSize: 2,
      blockSize: 2
    });
  h.DES = e._createHelper(m);
  g = g.TripleDES = e.extend({
    _doReset: function () {
      var b = this._key.words;
      this._des1 = m.createEncryptor(n.create(b.slice(0, 2)));
      this._des2 = m.createEncryptor(n.create(b.slice(2, 4)));
      this._des3 = m.createEncryptor(n.create(b.slice(4, 6)))
    },
    encryptBlock: function (b, c) {
      this._des1.encryptBlock(b, c);
      this._des2.decryptBlock(b, c);
      this._des3.encryptBlock(b, c)
    },
    decryptBlock: function (b, c) {
      this._des3.decryptBlock(b, c);
      this._des2.encryptBlock(b, c);
      this._des1.decryptBlock(b, c)
    },
    keySize: 6,
    ivSize: 2,
    blockSize: 2
  });
  h.TripleDES = e._createHelper(g)
})();

(function () {
  var h = CryptoJS,
    j = h.lib.WordArray;
  h.enc.Base64 = {
    stringify: function (b) {
      var e = b.words,
        f = b.sigBytes,
        c = this._map;
      b.clamp();
      b = [];
      for (var a = 0; a < f; a += 3) for (var d = (e[a >>> 2] >>> 24 - 8 * (a % 4) & 255) << 16 | (e[a + 1 >>> 2] >>> 24 - 8 * ((a + 1) % 4) & 255) << 8 | e[a + 2 >>> 2] >>> 24 - 8 * ((a + 2) % 4) & 255, g = 0; 4 > g && a + 0.75 * g < f; g++) b.push(c.charAt(d >>> 6 * (3 - g) & 63));
      if (e = c.charAt(64)) for (; b.length % 4;) b.push(e);
      return b.join("")
    },
    parse: function (b) {
      var e = b.length,
        f = this._map,
        c = f.charAt(64);
      c && (c = b.indexOf(c), -1 != c && (e = c));
      for (var c = [], a = 0, d = 0; d < e; d++) if (d % 4) {
        var g = f.indexOf(b.charAt(d - 1)) << 2 * (d % 4),
          h = f.indexOf(b.charAt(d)) >>> 6 - 2 * (d % 4);
        c[a >>> 2] |= (g | h) << 24 - 8 * (a % 4);
        a++
      }
      return j.create(c, a)
    },
    _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
  }
})();

(function (E) {
  function h(a, f, g, j, p, h, k) {
    a = a + (f & g | ~f & j) + p + k;
    return (a << h | a >>> 32 - h) + f
  }
  function k(a, f, g, j, p, h, k) {
    a = a + (f & j | g & ~j) + p + k;
    return (a << h | a >>> 32 - h) + f
  }
  function l(a, f, g, j, h, k, l) {
    a = a + (f ^ g ^ j) + h + l;
    return (a << k | a >>> 32 - k) + f
  }
  function n(a, f, g, j, h, k, l) {
    a = a + (g ^ (f | ~j)) + h + l;
    return (a << k | a >>> 32 - k) + f
  }
  for (var r = CryptoJS,
    q = r.lib,
    F = q.WordArray,
    s = q.Hasher,
    q = r.algo,
    a = [], t = 0; 64 > t; t++) a[t] = 4294967296 * E.abs(E.sin(t + 1)) | 0;
  q = q.MD5 = s.extend({
    _doReset: function () {
      this._hash = new F.init([1732584193, 4023233417, 2562383102, 271733878])
    },
    _doProcessBlock: function (m, f) {
      for (var g = 0; 16 > g; g++) {
        var j = f + g,
          p = m[j];
        m[j] = (p << 8 | p >>> 24) & 16711935 | (p << 24 | p >>> 8) & 4278255360
      }
      var g = this._hash.words,
        j = m[f + 0],
        p = m[f + 1],
        q = m[f + 2],
        r = m[f + 3],
        s = m[f + 4],
        t = m[f + 5],
        u = m[f + 6],
        v = m[f + 7],
        w = m[f + 8],
        x = m[f + 9],
        y = m[f + 10],
        z = m[f + 11],
        A = m[f + 12],
        B = m[f + 13],
        C = m[f + 14],
        D = m[f + 15],
        b = g[0],
        c = g[1],
        d = g[2],
        e = g[3],
        b = h(b, c, d, e, j, 7, a[0]),
        e = h(e, b, c, d, p, 12, a[1]),
        d = h(d, e, b, c, q, 17, a[2]),
        c = h(c, d, e, b, r, 22, a[3]),
        b = h(b, c, d, e, s, 7, a[4]),
        e = h(e, b, c, d, t, 12, a[5]),
        d = h(d, e, b, c, u, 17, a[6]),
        c = h(c, d, e, b, v, 22, a[7]),
        b = h(b, c, d, e, w, 7, a[8]),
        e = h(e, b, c, d, x, 12, a[9]),
        d = h(d, e, b, c, y, 17, a[10]),
        c = h(c, d, e, b, z, 22, a[11]),
        b = h(b, c, d, e, A, 7, a[12]),
        e = h(e, b, c, d, B, 12, a[13]),
        d = h(d, e, b, c, C, 17, a[14]),
        c = h(c, d, e, b, D, 22, a[15]),
        b = k(b, c, d, e, p, 5, a[16]),
        e = k(e, b, c, d, u, 9, a[17]),
        d = k(d, e, b, c, z, 14, a[18]),
        c = k(c, d, e, b, j, 20, a[19]),
        b = k(b, c, d, e, t, 5, a[20]),
        e = k(e, b, c, d, y, 9, a[21]),
        d = k(d, e, b, c, D, 14, a[22]),
        c = k(c, d, e, b, s, 20, a[23]),
        b = k(b, c, d, e, x, 5, a[24]),
        e = k(e, b, c, d, C, 9, a[25]),
        d = k(d, e, b, c, r, 14, a[26]),
        c = k(c, d, e, b, w, 20, a[27]),
        b = k(b, c, d, e, B, 5, a[28]),
        e = k(e, b, c, d, q, 9, a[29]),
        d = k(d, e, b, c, v, 14, a[30]),
        c = k(c, d, e, b, A, 20, a[31]),
        b = l(b, c, d, e, t, 4, a[32]),
        e = l(e, b, c, d, w, 11, a[33]),
        d = l(d, e, b, c, z, 16, a[34]),
        c = l(c, d, e, b, C, 23, a[35]),
        b = l(b, c, d, e, p, 4, a[36]),
        e = l(e, b, c, d, s, 11, a[37]),
        d = l(d, e, b, c, v, 16, a[38]),
        c = l(c, d, e, b, y, 23, a[39]),
        b = l(b, c, d, e, B, 4, a[40]),
        e = l(e, b, c, d, j, 11, a[41]),
        d = l(d, e, b, c, r, 16, a[42]),
        c = l(c, d, e, b, u, 23, a[43]),
        b = l(b, c, d, e, x, 4, a[44]),
        e = l(e, b, c, d, A, 11, a[45]),
        d = l(d, e, b, c, D, 16, a[46]),
        c = l(c, d, e, b, q, 23, a[47]),
        b = n(b, c, d, e, j, 6, a[48]),
        e = n(e, b, c, d, v, 10, a[49]),
        d = n(d, e, b, c, C, 15, a[50]),
        c = n(c, d, e, b, t, 21, a[51]),
        b = n(b, c, d, e, A, 6, a[52]),
        e = n(e, b, c, d, r, 10, a[53]),
        d = n(d, e, b, c, y, 15, a[54]),
        c = n(c, d, e, b, p, 21, a[55]),
        b = n(b, c, d, e, w, 6, a[56]),
        e = n(e, b, c, d, D, 10, a[57]),
        d = n(d, e, b, c, u, 15, a[58]),
        c = n(c, d, e, b, B, 21, a[59]),
        b = n(b, c, d, e, s, 6, a[60]),
        e = n(e, b, c, d, z, 10, a[61]),
        d = n(d, e, b, c, q, 15, a[62]),
        c = n(c, d, e, b, x, 21, a[63]);
      g[0] = g[0] + b | 0;
      g[1] = g[1] + c | 0;
      g[2] = g[2] + d | 0;
      g[3] = g[3] + e | 0
    },
    _doFinalize: function () {
      var a = this._data,
        f = a.words,
        g = 8 * this._nDataBytes,
        j = 8 * a.sigBytes;
      f[j >>> 5] |= 128 << 24 - j % 32;
      var h = E.floor(g / 4294967296);
      f[(j + 64 >>> 9 << 4) + 15] = (h << 8 | h >>> 24) & 16711935 | (h << 24 | h >>> 8) & 4278255360;
      f[(j + 64 >>> 9 << 4) + 14] = (g << 8 | g >>> 24) & 16711935 | (g << 24 | g >>> 8) & 4278255360;
      a.sigBytes = 4 * (f.length + 1);
      this._process();
      a = this._hash;
      f = a.words;
      for (g = 0; 4 > g; g++) j = f[g],
        f[g] = (j << 8 | j >>> 24) & 16711935 | (j << 24 | j >>> 8) & 4278255360;
      return a
    },
    clone: function () {
      var a = s.clone.call(this);
      a._hash = this._hash.clone();
      return a
    }
  });
  r.MD5 = s._createHelper(q);
  r.HmacMD5 = s._createHmacHelper(q)
})(Math);

(function () {
  var k = CryptoJS,
    b = k.lib,
    m = b.WordArray,
    l = b.Hasher,
    d = [],
    b = k.algo.SHA1 = l.extend({
      _doReset: function () {
        this._hash = new m.init([1732584193, 4023233417, 2562383102, 271733878, 3285377520])
      },
      _doProcessBlock: function (n, p) {
        for (var a = this._hash.words,
          e = a[0], f = a[1], h = a[2], j = a[3], b = a[4], c = 0; 80 > c; c++) {
          if (16 > c) d[c] = n[p + c] | 0;
          else {
            var g = d[c - 3] ^ d[c - 8] ^ d[c - 14] ^ d[c - 16];
            d[c] = g << 1 | g >>> 31
          }
          g = (e << 5 | e >>> 27) + b + d[c];
          g = 20 > c ? g + ((f & h | ~f & j) + 1518500249) : 40 > c ? g + ((f ^ h ^ j) + 1859775393) : 60 > c ? g + ((f & h | f & j | h & j) - 1894007588) : g + ((f ^ h ^ j) - 899497514);
          b = j;
          j = h;
          h = f << 30 | f >>> 2;
          f = e;
          e = g
        }
        a[0] = a[0] + e | 0;
        a[1] = a[1] + f | 0;
        a[2] = a[2] + h | 0;
        a[3] = a[3] + j | 0;
        a[4] = a[4] + b | 0
      },
      _doFinalize: function () {
        var b = this._data,
          d = b.words,
          a = 8 * this._nDataBytes,
          e = 8 * b.sigBytes;
        d[e >>> 5] |= 128 << 24 - e % 32;
        d[(e + 64 >>> 9 << 4) + 14] = Math.floor(a / 4294967296);
        d[(e + 64 >>> 9 << 4) + 15] = a;
        b.sigBytes = 4 * d.length;
        this._process();
        return this._hash
      },
      clone: function () {
        var b = l.clone.call(this);
        b._hash = this._hash.clone();
        return b
      }
    });
  k.SHA1 = l._createHelper(b);
  k.HmacSHA1 = l._createHmacHelper(b)
})();

(function (k) {
  for (var g = CryptoJS,
    h = g.lib,
    v = h.WordArray,
    j = h.Hasher,
    h = g.algo,
    s = [], t = [], u = function (q) {
      return 4294967296 * (q - (q | 0)) | 0
    },
    l = 2, b = 0; 64 > b;) {
    var d;
    a: {
      d = l;
      for (var w = k.sqrt(d), r = 2; r <= w; r++) if (!(d % r)) {
        d = !1;
        break a
      }
      d = !0
    }
    d && (8 > b && (s[b] = u(k.pow(l, 0.5))), t[b] = u(k.pow(l, 1 / 3)), b++);
    l++
  }
  var n = [],
    h = h.SHA256 = j.extend({
      _doReset: function () {
        this._hash = new v.init(s.slice(0))
      },
      _doProcessBlock: function (q, h) {
        for (var a = this._hash.words,
          c = a[0], d = a[1], b = a[2], k = a[3], f = a[4], g = a[5], j = a[6], l = a[7], e = 0; 64 > e; e++) {
          if (16 > e) n[e] = q[h + e] | 0;
          else {
            var m = n[e - 15],
              p = n[e - 2];
            n[e] = ((m << 25 | m >>> 7) ^ (m << 14 | m >>> 18) ^ m >>> 3) + n[e - 7] + ((p << 15 | p >>> 17) ^ (p << 13 | p >>> 19) ^ p >>> 10) + n[e - 16]
          }
          m = l + ((f << 26 | f >>> 6) ^ (f << 21 | f >>> 11) ^ (f << 7 | f >>> 25)) + (f & g ^ ~f & j) + t[e] + n[e];
          p = ((c << 30 | c >>> 2) ^ (c << 19 | c >>> 13) ^ (c << 10 | c >>> 22)) + (c & d ^ c & b ^ d & b);
          l = j;
          j = g;
          g = f;
          f = k + m | 0;
          k = b;
          b = d;
          d = c;
          c = m + p | 0
        }
        a[0] = a[0] + c | 0;
        a[1] = a[1] + d | 0;
        a[2] = a[2] + b | 0;
        a[3] = a[3] + k | 0;
        a[4] = a[4] + f | 0;
        a[5] = a[5] + g | 0;
        a[6] = a[6] + j | 0;
        a[7] = a[7] + l | 0
      },
      _doFinalize: function () {
        var d = this._data,
          b = d.words,
          a = 8 * this._nDataBytes,
          c = 8 * d.sigBytes;
        b[c >>> 5] |= 128 << 24 - c % 32;
        b[(c + 64 >>> 9 << 4) + 14] = k.floor(a / 4294967296);
        b[(c + 64 >>> 9 << 4) + 15] = a;
        d.sigBytes = 4 * b.length;
        this._process();
        return this._hash
      },
      clone: function () {
        var b = j.clone.call(this);
        b._hash = this._hash.clone();
        return b
      }
    });
  g.SHA256 = j._createHelper(h);
  g.HmacSHA256 = j._createHmacHelper(h)
})(Math);

(function () {
  var b = CryptoJS,
    d = b.lib.WordArray,
    a = b.algo,
    c = a.SHA256,
    a = a.SHA224 = c.extend({
      _doReset: function () {
        this._hash = new d.init([3238371032, 914150663, 812702999, 4144912697, 4290775857, 1750603025, 1694076839, 3204075428])
      },
      _doFinalize: function () {
        var a = c._doFinalize.call(this);
        a.sigBytes -= 4;
        return a
      }
    });
  b.SHA224 = c._createHelper(a);
  b.HmacSHA224 = c._createHmacHelper(a)
})();

(function () {
  function a() {
    return d.create.apply(d, arguments)
  }
  for (var n = CryptoJS,
    r = n.lib.Hasher,
    e = n.x64,
    d = e.Word,
    T = e.WordArray,
    e = n.algo,
    ea = [a(1116352408, 3609767458), a(1899447441, 602891725), a(3049323471, 3964484399), a(3921009573, 2173295548), a(961987163, 4081628472), a(1508970993, 3053834265), a(2453635748, 2937671579), a(2870763221, 3664609560), a(3624381080, 2734883394), a(310598401, 1164996542), a(607225278, 1323610764), a(1426881987, 3590304994), a(1925078388, 4068182383), a(2162078206, 991336113), a(2614888103, 633803317), a(3248222580, 3479774868), a(3835390401, 2666613458), a(4022224774, 944711139), a(264347078, 2341262773), a(604807628, 2007800933), a(770255983, 1495990901), a(1249150122, 1856431235), a(1555081692, 3175218132), a(1996064986, 2198950837), a(2554220882, 3999719339), a(2821834349, 766784016), a(2952996808, 2566594879), a(3210313671, 3203337956), a(3336571891, 1034457026), a(3584528711, 2466948901), a(113926993, 3758326383), a(338241895, 168717936), a(666307205, 1188179964), a(773529912, 1546045734), a(1294757372, 1522805485), a(1396182291, 2643833823), a(1695183700, 2343527390), a(1986661051, 1014477480), a(2177026350, 1206759142), a(2456956037, 344077627), a(2730485921, 1290863460), a(2820302411, 3158454273), a(3259730800, 3505952657), a(3345764771, 106217008), a(3516065817, 3606008344), a(3600352804, 1432725776), a(4094571909, 1467031594), a(275423344, 851169720), a(430227734, 3100823752), a(506948616, 1363258195), a(659060556, 3750685593), a(883997877, 3785050280), a(958139571, 3318307427), a(1322822218, 3812723403), a(1537002063, 2003034995), a(1747873779, 3602036899), a(1955562222, 1575990012), a(2024104815, 1125592928), a(2227730452, 2716904306), a(2361852424, 442776044), a(2428436474, 593698344), a(2756734187, 3733110249), a(3204031479, 2999351573), a(3329325298, 3815920427), a(3391569614, 3928383900), a(3515267271, 566280711), a(3940187606, 3454069534), a(4118630271, 4000239992), a(116418474, 1914138554), a(174292421, 2731055270), a(289380356, 3203993006), a(460393269, 320620315), a(685471733, 587496836), a(852142971, 1086792851), a(1017036298, 365543100), a(1126000580, 2618297676), a(1288033470, 3409855158), a(1501505948, 4234509866), a(1607167915, 987167468), a(1816402316, 1246189591)], v = [], w = 0; 80 > w; w++) v[w] = a();
  e = e.SHA512 = r.extend({
    _doReset: function () {
      this._hash = new T.init([new d.init(1779033703, 4089235720), new d.init(3144134277, 2227873595), new d.init(1013904242, 4271175723), new d.init(2773480762, 1595750129), new d.init(1359893119, 2917565137), new d.init(2600822924, 725511199), new d.init(528734635, 4215389547), new d.init(1541459225, 327033209)])
    },
    _doProcessBlock: function (a, d) {
      for (var f = this._hash.words,
        F = f[0], e = f[1], n = f[2], r = f[3], G = f[4], H = f[5], I = f[6], f = f[7], w = F.high, J = F.low, X = e.high, K = e.low, Y = n.high, L = n.low, Z = r.high, M = r.low, $ = G.high, N = G.low, aa = H.high, O = H.low, ba = I.high, P = I.low, ca = f.high, Q = f.low, k = w, g = J, z = X, x = K, A = Y, y = L, U = Z, B = M, l = $, h = N, R = aa, C = O, S = ba, D = P, V = ca, E = Q, m = 0; 80 > m; m++) {
        var s = v[m];
        if (16 > m) var j = s.high = a[d + 2 * m] | 0,
          b = s.low = a[d + 2 * m + 1] | 0;
        else {
          var j = v[m - 15],
            b = j.high,
            p = j.low,
            j = (b >>> 1 | p << 31) ^ (b >>> 8 | p << 24) ^ b >>> 7,
            p = (p >>> 1 | b << 31) ^ (p >>> 8 | b << 24) ^ (p >>> 7 | b << 25),
            u = v[m - 2],
            b = u.high,
            c = u.low,
            u = (b >>> 19 | c << 13) ^ (b << 3 | c >>> 29) ^ b >>> 6,
            c = (c >>> 19 | b << 13) ^ (c << 3 | b >>> 29) ^ (c >>> 6 | b << 26),
            b = v[m - 7],
            W = b.high,
            t = v[m - 16],
            q = t.high,
            t = t.low,
            b = p + b.low,
            j = j + W + (b >>> 0 < p >>> 0 ? 1 : 0),
            b = b + c,
            j = j + u + (b >>> 0 < c >>> 0 ? 1 : 0),
            b = b + t,
            j = j + q + (b >>> 0 < t >>> 0 ? 1 : 0);
          s.high = j;
          s.low = b
        }
        var W = l & R ^ ~l & S,
          t = h & C ^ ~h & D,
          s = k & z ^ k & A ^ z & A,
          T = g & x ^ g & y ^ x & y,
          p = (k >>> 28 | g << 4) ^ (k << 30 | g >>> 2) ^ (k << 25 | g >>> 7),
          u = (g >>> 28 | k << 4) ^ (g << 30 | k >>> 2) ^ (g << 25 | k >>> 7),
          c = ea[m],
          fa = c.high,
          da = c.low,
          c = E + ((h >>> 14 | l << 18) ^ (h >>> 18 | l << 14) ^ (h << 23 | l >>> 9)),
          q = V + ((l >>> 14 | h << 18) ^ (l >>> 18 | h << 14) ^ (l << 23 | h >>> 9)) + (c >>> 0 < E >>> 0 ? 1 : 0),
          c = c + t,
          q = q + W + (c >>> 0 < t >>> 0 ? 1 : 0),
          c = c + da,
          q = q + fa + (c >>> 0 < da >>> 0 ? 1 : 0),
          c = c + b,
          q = q + j + (c >>> 0 < b >>> 0 ? 1 : 0),
          b = u + T,
          s = p + s + (b >>> 0 < u >>> 0 ? 1 : 0),
          V = S,
          E = D,
          S = R,
          D = C,
          R = l,
          C = h,
          h = B + c | 0,
          l = U + q + (h >>> 0 < B >>> 0 ? 1 : 0) | 0,
          U = A,
          B = y,
          A = z,
          y = x,
          z = k,
          x = g,
          g = c + b | 0,
          k = q + s + (g >>> 0 < c >>> 0 ? 1 : 0) | 0
      }
      J = F.low = J + g;
      F.high = w + k + (J >>> 0 < g >>> 0 ? 1 : 0);
      K = e.low = K + x;
      e.high = X + z + (K >>> 0 < x >>> 0 ? 1 : 0);
      L = n.low = L + y;
      n.high = Y + A + (L >>> 0 < y >>> 0 ? 1 : 0);
      M = r.low = M + B;
      r.high = Z + U + (M >>> 0 < B >>> 0 ? 1 : 0);
      N = G.low = N + h;
      G.high = $ + l + (N >>> 0 < h >>> 0 ? 1 : 0);
      O = H.low = O + C;
      H.high = aa + R + (O >>> 0 < C >>> 0 ? 1 : 0);
      P = I.low = P + D;
      I.high = ba + S + (P >>> 0 < D >>> 0 ? 1 : 0);
      Q = f.low = Q + E;
      f.high = ca + V + (Q >>> 0 < E >>> 0 ? 1 : 0)
    },
    _doFinalize: function () {
      var a = this._data,
        d = a.words,
        f = 8 * this._nDataBytes,
        e = 8 * a.sigBytes;
      d[e >>> 5] |= 128 << 24 - e % 32;
      d[(e + 128 >>> 10 << 5) + 30] = Math.floor(f / 4294967296);
      d[(e + 128 >>> 10 << 5) + 31] = f;
      a.sigBytes = 4 * d.length;
      this._process();
      return this._hash.toX32()
    },
    clone: function () {
      var a = r.clone.call(this);
      a._hash = this._hash.clone();
      return a
    },
    blockSize: 32
  });
  n.SHA512 = r._createHelper(e);
  n.HmacSHA512 = r._createHmacHelper(e)
})();

(function () {
  var c = CryptoJS,
    a = c.x64,
    b = a.Word,
    e = a.WordArray,
    a = c.algo,
    d = a.SHA512,
    a = a.SHA384 = d.extend({
      _doReset: function () {
        this._hash = new e.init([new b.init(3418070365, 3238371032), new b.init(1654270250, 914150663), new b.init(2438529370, 812702999), new b.init(355462360, 4144912697), new b.init(1731405415, 4290775857), new b.init(2394180231, 1750603025), new b.init(3675008525, 1694076839), new b.init(1203062813, 3204075428)])
      },
      _doFinalize: function () {
        var a = d._doFinalize.call(this);
        a.sigBytes -= 16;
        return a
      }
    });
  c.SHA384 = d._createHelper(a);
  c.HmacSHA384 = d._createHmacHelper(a)
})();

(function () {
  var q = CryptoJS,
    d = q.lib,
    n = d.WordArray,
    p = d.Hasher,
    d = q.algo,
    x = n.create([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13]),
    y = n.create([5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11]),
    z = n.create([11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6]),
    A = n.create([8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11]),
    B = n.create([0, 1518500249, 1859775393, 2400959708, 2840853838]),
    C = n.create([1352829926, 1548603684, 1836072691, 2053994217, 0]),
    d = d.RIPEMD160 = p.extend({
      _doReset: function () {
        this._hash = n.create([1732584193, 4023233417, 2562383102, 271733878, 3285377520])
      },
      _doProcessBlock: function (e, v) {
        for (var b = 0; 16 > b; b++) {
          var c = v + b,
            f = e[c];
          e[c] = (f << 8 | f >>> 24) & 16711935 | (f << 24 | f >>> 8) & 4278255360
        }
        var c = this._hash.words,
          f = B.words,
          d = C.words,
          n = x.words,
          q = y.words,
          p = z.words,
          w = A.words,
          t, g, h, j, r, u, k, l, m, s;
        u = t = c[0];
        k = g = c[1];
        l = h = c[2];
        m = j = c[3];
        s = r = c[4];
        for (var a, b = 0; 80 > b; b += 1) a = t + e[v + n[b]] | 0,
          a = 16 > b ? a + ((g ^ h ^ j) + f[0]) : 32 > b ? a + ((g & h | ~g & j) + f[1]) : 48 > b ? a + (((g | ~h) ^ j) + f[2]) : 64 > b ? a + ((g & j | h & ~j) + f[3]) : a + ((g ^ (h | ~j)) + f[4]),
          a |= 0,
          a = a << p[b] | a >>> 32 - p[b],
          a = a + r | 0,
          t = r,
          r = j,
          j = h << 10 | h >>> 22,
          h = g,
          g = a,
          a = u + e[v + q[b]] | 0,
          a = 16 > b ? a + ((k ^ (l | ~m)) + d[0]) : 32 > b ? a + ((k & m | l & ~m) + d[1]) : 48 > b ? a + (((k | ~l) ^ m) + d[2]) : 64 > b ? a + ((k & l | ~k & m) + d[3]) : a + ((k ^ l ^ m) + d[4]),
          a |= 0,
          a = a << w[b] | a >>> 32 - w[b],
          a = a + s | 0,
          u = s,
          s = m,
          m = l << 10 | l >>> 22,
          l = k,
          k = a;
        a = c[1] + h + m | 0;
        c[1] = c[2] + j + s | 0;
        c[2] = c[3] + r + u | 0;
        c[3] = c[4] + t + k | 0;
        c[4] = c[0] + g + l | 0;
        c[0] = a
      },
      _doFinalize: function () {
        var e = this._data,
          d = e.words,
          b = 8 * this._nDataBytes,
          c = 8 * e.sigBytes;
        d[c >>> 5] |= 128 << 24 - c % 32;
        d[(c + 64 >>> 9 << 4) + 14] = (b << 8 | b >>> 24) & 16711935 | (b << 24 | b >>> 8) & 4278255360;
        e.sigBytes = 4 * (d.length + 1);
        this._process();
        e = this._hash;
        d = e.words;
        for (b = 0; 5 > b; b++) c = d[b],
          d[b] = (c << 8 | c >>> 24) & 16711935 | (c << 24 | c >>> 8) & 4278255360;
        return e
      },
      clone: function () {
        var d = p.clone.call(this);
        d._hash = this._hash.clone();
        return d
      }
    });
  q.RIPEMD160 = p._createHelper(d);
  q.HmacRIPEMD160 = p._createHmacHelper(d)
})(Math);

/*
CryptoJS v3.1.2 hmac.js
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
(function () {
  var c = CryptoJS,
    k = c.enc.Utf8;
  c.algo.HMAC = c.lib.Base.extend({
    init: function (a, b) {
      a = this._hasher = new a.init;
      "string" == typeof b && (b = k.parse(b));
      var c = a.blockSize,
        e = 4 * c;
      b.sigBytes > e && (b = a.finalize(b));
      b.clamp();
      for (var f = this._oKey = b.clone(), g = this._iKey = b.clone(), h = f.words, j = g.words, d = 0; d < c; d++) h[d] ^= 1549556828,
        j[d] ^= 909522486;
      f.sigBytes = g.sigBytes = e;
      this.reset()
    },
    reset: function () {
      var a = this._hasher;
      a.reset();
      a.update(this._iKey)
    },
    update: function (a) {
      this._hasher.update(a);
      return this
    },
    finalize: function (a) {
      var b = this._hasher;
      a = b.finalize(a);
      b.reset();
      return b.finalize(this._oKey.clone().concat(a))
    }
  })
})();

/*
CryptoJS v3.1.2 pbkdf2-min.js
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
(function () {
  var b = CryptoJS,
    a = b.lib,
    d = a.Base,
    m = a.WordArray,
    a = b.algo,
    q = a.HMAC,
    l = a.PBKDF2 = d.extend({
      cfg: d.extend({
        keySize: 4,
        hasher: a.SHA1,
        iterations: 1
      }),
      init: function (a) {
        this.cfg = this.cfg.extend(a)
      },
      compute: function (a, b) {
        for (var c = this.cfg,
          f = q.create(c.hasher, a), g = m.create(), d = m.create([1]), l = g.words, r = d.words, n = c.keySize, c = c.iterations; l.length < n;) {
          var h = f.update(b).finalize(d);
          f.reset();
          for (var j = h.words,
            s = j.length,
            k = h,
            p = 1; p < c; p++) {
            k = f.finalize(k);
            f.reset();
            for (var t = k.words,
              e = 0; e < s; e++) j[e] ^= t[e]
          }
          g.concat(h);
          r[0]++
        }
        g.sigBytes = 4 * n;
        return g
      }
    });
  b.PBKDF2 = function (a, b, c) {
    return l.create(c).compute(a, b)
  }
})();

/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
var b64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var b64pad = "=";
function hex2b64(d) {
  var b;
  var e;
  var a = "";
  for (b = 0; b + 3 <= d.length; b += 3) {
    e = parseInt(d.substring(b, b + 3), 16);
    a += b64map.charAt(e >> 6) + b64map.charAt(e & 63)
  }
  if (b + 1 == d.length) {
    e = parseInt(d.substring(b, b + 1), 16);
    a += b64map.charAt(e << 2)
  } else {
    if (b + 2 == d.length) {
      e = parseInt(d.substring(b, b + 2), 16);
      a += b64map.charAt(e >> 2) + b64map.charAt((e & 3) << 4)
    }
  }
  if (b64pad) {
    while ((a.length & 3) > 0) {
      a += b64pad
    }
  }
  return a
}
function b64tohex(f) {
  var d = "";
  var e;
  var b = 0;
  var c;
  var a;
  for (e = 0; e < f.length; ++e) {
    if (f.charAt(e) == b64pad) {
      break
    }
    a = b64map.indexOf(f.charAt(e));
    if (a < 0) {
      continue
    }
    if (b == 0) {
      d += int2char(a >> 2);
      c = a & 3;
      b = 1
    } else {
      if (b == 1) {
        d += int2char((c << 2) | (a >> 4));
        c = a & 15;
        b = 2
      } else {
        if (b == 2) {
          d += int2char(c);
          d += int2char(a >> 2);
          c = a & 3;
          b = 3
        } else {
          d += int2char((c << 2) | (a >> 4));
          d += int2char(a & 15);
          b = 0
        }
      }
    }
  }
  if (b == 1) {
    d += int2char(c << 2)
  }
  return d
}
function b64toBA(e) {
  var d = b64tohex(e);
  var c;
  var b = new Array();
  for (c = 0; 2 * c < d.length; ++c) {
    b[c] = parseInt(d.substring(2 * c, 2 * c + 2), 16)
  }
  return b
};
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
var dbits;
var canary = 244837814094590;
var j_lm = ((canary & 16777215) == 15715070);
function BigInteger(e, d, f) {
  if (e != null) {
    if ("number" == typeof e) {
      this.fromNumber(e, d, f)
    } else {
      if (d == null && "string" != typeof e) {
        this.fromString(e, 256)
      } else {
        this.fromString(e, d)
      }
    }
  }
}
function nbi() {
  return new BigInteger(null)
}
function am1(f, a, b, e, h, g) {
  while (--g >= 0) {
    var d = a * this[f++] + b[e] + h;
    h = Math.floor(d / 67108864);
    b[e++] = d & 67108863
  }
  return h
}
function am2(f, q, r, e, o, a) {
  var k = q & 32767,
    p = q >> 15;
  while (--a >= 0) {
    var d = this[f] & 32767;
    var g = this[f++] >> 15;
    var b = p * d + g * k;
    d = k * d + ((b & 32767) << 15) + r[e] + (o & 1073741823);
    o = (d >>> 30) + (b >>> 15) + p * g + (o >>> 30);
    r[e++] = d & 1073741823
  }
  return o
}
function am3(f, q, r, e, o, a) {
  var k = q & 16383,
    p = q >> 14;
  while (--a >= 0) {
    var d = this[f] & 16383;
    var g = this[f++] >> 14;
    var b = p * d + g * k;
    d = k * d + ((b & 16383) << 14) + r[e] + o;
    o = (d >> 28) + (b >> 14) + p * g;
    r[e++] = d & 268435455
  }
  return o
}
if (j_lm && (navigator2.appName == "Microsoft Internet Explorer")) {
  BigInteger.prototype.am = am2;
  dbits = 30
} else {
  if (j_lm && (navigator2.appName != "Netscape")) {
    BigInteger.prototype.am = am1;
    dbits = 26
  } else {
    BigInteger.prototype.am = am3;
    dbits = 28
  }
}
BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1 << dbits) - 1);
BigInteger.prototype.DV = (1 << dbits);
var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2, BI_FP);
BigInteger.prototype.F1 = BI_FP - dbits;
BigInteger.prototype.F2 = 2 * dbits - BI_FP;
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr, vv;
rr = "0".charCodeAt(0);
for (vv = 0; vv <= 9; ++vv) {
  BI_RC[rr++] = vv
}
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) {
  BI_RC[rr++] = vv
}
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) {
  BI_RC[rr++] = vv
}
function int2char(a) {
  return BI_RM.charAt(a)
}
function intAt(b, a) {
  var d = BI_RC[b.charCodeAt(a)];
  return (d == null) ? -1 : d
}
function bnpCopyTo(b) {
  for (var a = this.t - 1; a >= 0; --a) {
    b[a] = this[a]
  }
  b.t = this.t;
  b.s = this.s
}
function bnpFromInt(a) {
  this.t = 1;
  this.s = (a < 0) ? -1 : 0;
  if (a > 0) {
    this[0] = a
  } else {
    if (a < -1) {
      this[0] = a + this.DV
    } else {
      this.t = 0
    }
  }
}
function nbv(a) {
  var b = nbi();
  b.fromInt(a);
  return b
}
function bnpFromString(h, c) {
  var e;
  if (c == 16) {
    e = 4
  } else {
    if (c == 8) {
      e = 3
    } else {
      if (c == 256) {
        e = 8
      } else {
        if (c == 2) {
          e = 1
        } else {
          if (c == 32) {
            e = 5
          } else {
            if (c == 4) {
              e = 2
            } else {
              this.fromRadix(h, c);
              return
            }
          }
        }
      }
    }
  }
  this.t = 0;
  this.s = 0;
  var g = h.length,
    d = false,
    f = 0;
  while (--g >= 0) {
    var a = (e == 8) ? h[g] & 255 : intAt(h, g);
    if (a < 0) {
      if (h.charAt(g) == "-") {
        d = true
      }
      continue
    }
    d = false;
    if (f == 0) {
      this[this.t++] = a
    } else {
      if (f + e > this.DB) {
        this[this.t - 1] |= (a & ((1 << (this.DB - f)) - 1)) << f;
        this[this.t++] = (a >> (this.DB - f))
      } else {
        this[this.t - 1] |= a << f
      }
    }
    f += e;
    if (f >= this.DB) {
      f -= this.DB
    }
  }
  if (e == 8 && (h[0] & 128) != 0) {
    this.s = -1;
    if (f > 0) {
      this[this.t - 1] |= ((1 << (this.DB - f)) - 1) << f
    }
  }
  this.clamp();
  if (d) {
    BigInteger.ZERO.subTo(this, this)
  }
}
function bnpClamp() {
  var a = this.s & this.DM;
  while (this.t > 0 && this[this.t - 1] == a) {
    --this.t
  }
}
function bnToString(c) {
  if (this.s < 0) {
    return "-" + this.negate().toString(c)
  }
  var e;
  if (c == 16) {
    e = 4
  } else {
    if (c == 8) {
      e = 3
    } else {
      if (c == 2) {
        e = 1
      } else {
        if (c == 32) {
          e = 5
        } else {
          if (c == 4) {
            e = 2
          } else {
            return this.toRadix(c)
          }
        }
      }
    }
  }
  var g = (1 << e) - 1,
    l,
    a = false,
    h = "",
    f = this.t;
  var j = this.DB - (f * this.DB) % e;
  if (f-- > 0) {
    if (j < this.DB && (l = this[f] >> j) > 0) {
      a = true;
      h = int2char(l)
    }
    while (f >= 0) {
      if (j < e) {
        l = (this[f] & ((1 << j) - 1)) << (e - j);
        l |= this[--f] >> (j += this.DB - e)
      } else {
        l = (this[f] >> (j -= e)) & g;
        if (j <= 0) {
          j += this.DB; --f
        }
      }
      if (l > 0) {
        a = true
      }
      if (a) {
        h += int2char(l)
      }
    }
  }
  return a ? h : "0"
}
function bnNegate() {
  var a = nbi();
  BigInteger.ZERO.subTo(this, a);
  return a
}
function bnAbs() {
  return (this.s < 0) ? this.negate() : this
}
function bnCompareTo(b) {
  var d = this.s - b.s;
  if (d != 0) {
    return d
  }
  var c = this.t;
  d = c - b.t;
  if (d != 0) {
    return (this.s < 0) ? -d : d
  }
  while (--c >= 0) {
    if ((d = this[c] - b[c]) != 0) {
      return d
    }
  }
  return 0
}
function nbits(a) {
  var c = 1,
    b;
  if ((b = a >>> 16) != 0) {
    a = b;
    c += 16
  }
  if ((b = a >> 8) != 0) {
    a = b;
    c += 8
  }
  if ((b = a >> 4) != 0) {
    a = b;
    c += 4
  }
  if ((b = a >> 2) != 0) {
    a = b;
    c += 2
  }
  if ((b = a >> 1) != 0) {
    a = b;
    c += 1
  }
  return c
}
function bnBitLength() {
  if (this.t <= 0) {
    return 0
  }
  return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ (this.s & this.DM))
}
function bnpDLShiftTo(c, b) {
  var a;
  for (a = this.t - 1; a >= 0; --a) {
    b[a + c] = this[a]
  }
  for (a = c - 1; a >= 0; --a) {
    b[a] = 0
  }
  b.t = this.t + c;
  b.s = this.s
}
function bnpDRShiftTo(c, b) {
  for (var a = c; a < this.t; ++a) {
    b[a - c] = this[a]
  }
  b.t = Math.max(this.t - c, 0);
  b.s = this.s
}
function bnpLShiftTo(j, e) {
  var b = j % this.DB;
  var a = this.DB - b;
  var g = (1 << a) - 1;
  var f = Math.floor(j / this.DB),
    h = (this.s << b) & this.DM,
    d;
  for (d = this.t - 1; d >= 0; --d) {
    e[d + f + 1] = (this[d] >> a) | h;
    h = (this[d] & g) << b
  }
  for (d = f - 1; d >= 0; --d) {
    e[d] = 0
  }
  e[f] = h;
  e.t = this.t + f + 1;
  e.s = this.s;
  e.clamp()
}
function bnpRShiftTo(g, d) {
  d.s = this.s;
  var e = Math.floor(g / this.DB);
  if (e >= this.t) {
    d.t = 0;
    return
  }
  var b = g % this.DB;
  var a = this.DB - b;
  var f = (1 << b) - 1;
  d[0] = this[e] >> b;
  for (var c = e + 1; c < this.t; ++c) {
    d[c - e - 1] |= (this[c] & f) << a;
    d[c - e] = this[c] >> b
  }
  if (b > 0) {
    d[this.t - e - 1] |= (this.s & f) << a
  }
  d.t = this.t - e;
  d.clamp()
}
function bnpSubTo(d, f) {
  var e = 0,
    g = 0,
    b = Math.min(d.t, this.t);
  while (e < b) {
    g += this[e] - d[e];
    f[e++] = g & this.DM;
    g >>= this.DB
  }
  if (d.t < this.t) {
    g -= d.s;
    while (e < this.t) {
      g += this[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g += this.s
  } else {
    g += this.s;
    while (e < d.t) {
      g -= d[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g -= d.s
  }
  f.s = (g < 0) ? -1 : 0;
  if (g < -1) {
    f[e++] = this.DV + g
  } else {
    if (g > 0) {
      f[e++] = g
    }
  }
  f.t = e;
  f.clamp()
}
function bnpMultiplyTo(c, e) {
  var b = this.abs(),
    f = c.abs();
  var d = b.t;
  e.t = d + f.t;
  while (--d >= 0) {
    e[d] = 0
  }
  for (d = 0; d < f.t; ++d) {
    e[d + b.t] = b.am(0, f[d], e, d, 0, b.t)
  }
  e.s = 0;
  e.clamp();
  if (this.s != c.s) {
    BigInteger.ZERO.subTo(e, e)
  }
}
function bnpSquareTo(d) {
  var a = this.abs();
  var b = d.t = 2 * a.t;
  while (--b >= 0) {
    d[b] = 0
  }
  for (b = 0; b < a.t - 1; ++b) {
    var e = a.am(b, a[b], d, 2 * b, 0, 1);
    if ((d[b + a.t] += a.am(b + 1, 2 * a[b], d, 2 * b + 1, e, a.t - b - 1)) >= a.DV) {
      d[b + a.t] -= a.DV;
      d[b + a.t + 1] = 1
    }
  }
  if (d.t > 0) {
    d[d.t - 1] += a.am(b, a[b], d, 2 * b, 0, 1)
  }
  d.s = 0;
  d.clamp()
}
function bnpDivRemTo(n, h, g) {
  var w = n.abs();
  if (w.t <= 0) {
    return
  }
  var k = this.abs();
  if (k.t < w.t) {
    if (h != null) {
      h.fromInt(0)
    }
    if (g != null) {
      this.copyTo(g)
    }
    return
  }
  if (g == null) {
    g = nbi()
  }
  var d = nbi(),
    a = this.s,
    l = n.s;
  var v = this.DB - nbits(w[w.t - 1]);
  if (v > 0) {
    w.lShiftTo(v, d);
    k.lShiftTo(v, g)
  } else {
    w.copyTo(d);
    k.copyTo(g)
  }
  var p = d.t;
  var b = d[p - 1];
  if (b == 0) {
    return
  }
  var o = b * (1 << this.F1) + ((p > 1) ? d[p - 2] >> this.F2 : 0);
  var A = this.FV / o,
    z = (1 << this.F1) / o,
    x = 1 << this.F2;
  var u = g.t,
    s = u - p,
    f = (h == null) ? nbi() : h;
  d.dlShiftTo(s, f);
  if (g.compareTo(f) >= 0) {
    g[g.t++] = 1;
    g.subTo(f, g)
  }
  BigInteger.ONE.dlShiftTo(p, f);
  f.subTo(d, d);
  while (d.t < p) {
    d[d.t++] = 0
  }
  while (--s >= 0) {
    var c = (g[--u] == b) ? this.DM : Math.floor(g[u] * A + (g[u - 1] + x) * z);
    if ((g[u] += d.am(0, c, g, s, 0, p)) < c) {
      d.dlShiftTo(s, f);
      g.subTo(f, g);
      while (g[u] < --c) {
        g.subTo(f, g)
      }
    }
  }
  if (h != null) {
    g.drShiftTo(p, h);
    if (a != l) {
      BigInteger.ZERO.subTo(h, h)
    }
  }
  g.t = p;
  g.clamp();
  if (v > 0) {
    g.rShiftTo(v, g)
  }
  if (a < 0) {
    BigInteger.ZERO.subTo(g, g)
  }
}
function bnMod(b) {
  var c = nbi();
  this.abs().divRemTo(b, null, c);
  if (this.s < 0 && c.compareTo(BigInteger.ZERO) > 0) {
    b.subTo(c, c)
  }
  return c
}
function Classic(a) {
  this.m = a
}
function cConvert(a) {
  if (a.s < 0 || a.compareTo(this.m) >= 0) {
    return a.mod(this.m)
  } else {
    return a
  }
}
function cRevert(a) {
  return a
}
function cReduce(a) {
  a.divRemTo(this.m, null, a)
}
function cMulTo(a, c, b) {
  a.multiplyTo(c, b);
  this.reduce(b)
}
function cSqrTo(a, b) {
  a.squareTo(b);
  this.reduce(b)
}
Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;
function bnpInvDigit() {
  if (this.t < 1) {
    return 0
  }
  var a = this[0];
  if ((a & 1) == 0) {
    return 0
  }
  var b = a & 3;
  b = (b * (2 - (a & 15) * b)) & 15;
  b = (b * (2 - (a & 255) * b)) & 255;
  b = (b * (2 - (((a & 65535) * b) & 65535))) & 65535;
  b = (b * (2 - a * b % this.DV)) % this.DV;
  return (b > 0) ? this.DV - b : -b
}
function Montgomery(a) {
  this.m = a;
  this.mp = a.invDigit();
  this.mpl = this.mp & 32767;
  this.mph = this.mp >> 15;
  this.um = (1 << (a.DB - 15)) - 1;
  this.mt2 = 2 * a.t
}
function montConvert(a) {
  var b = nbi();
  a.abs().dlShiftTo(this.m.t, b);
  b.divRemTo(this.m, null, b);
  if (a.s < 0 && b.compareTo(BigInteger.ZERO) > 0) {
    this.m.subTo(b, b)
  }
  return b
}
function montRevert(a) {
  var b = nbi();
  a.copyTo(b);
  this.reduce(b);
  return b
}
function montReduce(a) {
  while (a.t <= this.mt2) {
    a[a.t++] = 0
  }
  for (var c = 0; c < this.m.t; ++c) {
    var b = a[c] & 32767;
    var d = (b * this.mpl + (((b * this.mph + (a[c] >> 15) * this.mpl) & this.um) << 15)) & a.DM;
    b = c + this.m.t;
    a[b] += this.m.am(0, d, a, c, 0, this.m.t);
    while (a[b] >= a.DV) {
      a[b] -= a.DV;
      a[++b]++
    }
  }
  a.clamp();
  a.drShiftTo(this.m.t, a);
  if (a.compareTo(this.m) >= 0) {
    a.subTo(this.m, a)
  }
}
function montSqrTo(a, b) {
  a.squareTo(b);
  this.reduce(b)
}
function montMulTo(a, c, b) {
  a.multiplyTo(c, b);
  this.reduce(b)
}
Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;
function bnpIsEven() {
  return ((this.t > 0) ? (this[0] & 1) : this.s) == 0
}
function bnpExp(h, j) {
  if (h > 4294967295 || h < 1) {
    return BigInteger.ONE
  }
  var f = nbi(),
    a = nbi(),
    d = j.convert(this),
    c = nbits(h) - 1;
  d.copyTo(f);
  while (--c >= 0) {
    j.sqrTo(f, a);
    if ((h & (1 << c)) > 0) {
      j.mulTo(a, d, f)
    } else {
      var b = f;
      f = a;
      a = b
    }
  }
  return j.revert(f)
}
function bnModPowInt(b, a) {
  var c;
  if (b < 256 || a.isEven()) {
    c = new Classic(a)
  } else {
    c = new Montgomery(a)
  }
  return this.exp(b, c)
}
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function bnClone() {
  var a = nbi();
  this.copyTo(a);
  return a
}
function bnIntValue() {
  if (this.s < 0) {
    if (this.t == 1) {
      return this[0] - this.DV
    } else {
      if (this.t == 0) {
        return - 1
      }
    }
  } else {
    if (this.t == 1) {
      return this[0]
    } else {
      if (this.t == 0) {
        return 0
      }
    }
  }
  return ((this[1] & ((1 << (32 - this.DB)) - 1)) << this.DB) | this[0]
}
function bnByteValue() {
  return (this.t == 0) ? this.s : (this[0] << 24) >> 24
}
function bnShortValue() {
  return (this.t == 0) ? this.s : (this[0] << 16) >> 16
}
function bnpChunkSize(a) {
  return Math.floor(Math.LN2 * this.DB / Math.log(a))
}
function bnSigNum() {
  if (this.s < 0) {
    return - 1
  } else {
    if (this.t <= 0 || (this.t == 1 && this[0] <= 0)) {
      return 0
    } else {
      return 1
    }
  }
}
function bnpToRadix(c) {
  if (c == null) {
    c = 10
  }
  if (this.signum() == 0 || c < 2 || c > 36) {
    return "0"
  }
  var f = this.chunkSize(c);
  var e = Math.pow(c, f);
  var i = nbv(e),
    j = nbi(),
    h = nbi(),
    g = "";
  this.divRemTo(i, j, h);
  while (j.signum() > 0) {
    g = (e + h.intValue()).toString(c).substr(1) + g;
    j.divRemTo(i, j, h)
  }
  return h.intValue().toString(c) + g
}
function bnpFromRadix(m, h) {
  this.fromInt(0);
  if (h == null) {
    h = 10
  }
  var f = this.chunkSize(h);
  var g = Math.pow(h, f),
    e = false,
    a = 0,
    l = 0;
  for (var c = 0; c < m.length; ++c) {
    var k = intAt(m, c);
    if (k < 0) {
      if (m.charAt(c) == "-" && this.signum() == 0) {
        e = true
      }
      continue
    }
    l = h * l + k;
    if (++a >= f) {
      this.dMultiply(g);
      this.dAddOffset(l, 0);
      a = 0;
      l = 0
    }
  }
  if (a > 0) {
    this.dMultiply(Math.pow(h, a));
    this.dAddOffset(l, 0)
  }
  if (e) {
    BigInteger.ZERO.subTo(this, this)
  }
}
function bnpFromNumber(f, e, h) {
  if ("number" == typeof e) {
    if (f < 2) {
      this.fromInt(1)
    } else {
      this.fromNumber(f, h);
      if (!this.testBit(f - 1)) {
        this.bitwiseTo(BigInteger.ONE.shiftLeft(f - 1), op_or, this)
      }
      if (this.isEven()) {
        this.dAddOffset(1, 0)
      }
      while (!this.isProbablePrime(e)) {
        this.dAddOffset(2, 0);
        if (this.bitLength() > f) {
          this.subTo(BigInteger.ONE.shiftLeft(f - 1), this)
        }
      }
    }
  } else {
    var d = new Array(),
      g = f & 7;
    d.length = (f >> 3) + 1;
    e.nextBytes(d);
    if (g > 0) {
      d[0] &= ((1 << g) - 1)
    } else {
      d[0] = 0
    }
    this.fromString(d, 256)
  }
}
function bnToByteArray() {
  var b = this.t,
    c = new Array();
  c[0] = this.s;
  var e = this.DB - (b * this.DB) % 8,
    f,
    a = 0;
  if (b-- > 0) {
    if (e < this.DB && (f = this[b] >> e) != (this.s & this.DM) >> e) {
      c[a++] = f | (this.s << (this.DB - e))
    }
    while (b >= 0) {
      if (e < 8) {
        f = (this[b] & ((1 << e) - 1)) << (8 - e);
        f |= this[--b] >> (e += this.DB - 8)
      } else {
        f = (this[b] >> (e -= 8)) & 255;
        if (e <= 0) {
          e += this.DB; --b
        }
      }
      if ((f & 128) != 0) {
        f |= -256
      }
      if (a == 0 && (this.s & 128) != (f & 128)) {
        ++a
      }
      if (a > 0 || f != this.s) {
        c[a++] = f
      }
    }
  }
  return c
}
function bnEquals(b) {
  return (this.compareTo(b) == 0)
}
function bnMin(b) {
  return (this.compareTo(b) < 0) ? this : b
}
function bnMax(b) {
  return (this.compareTo(b) > 0) ? this : b
}
function bnpBitwiseTo(c, h, e) {
  var d, g, b = Math.min(c.t, this.t);
  for (d = 0; d < b; ++d) {
    e[d] = h(this[d], c[d])
  }
  if (c.t < this.t) {
    g = c.s & this.DM;
    for (d = b; d < this.t; ++d) {
      e[d] = h(this[d], g)
    }
    e.t = this.t
  } else {
    g = this.s & this.DM;
    for (d = b; d < c.t; ++d) {
      e[d] = h(g, c[d])
    }
    e.t = c.t
  }
  e.s = h(this.s, c.s);
  e.clamp()
}
function op_and(a, b) {
  return a & b
}
function bnAnd(b) {
  var c = nbi();
  this.bitwiseTo(b, op_and, c);
  return c
}
function op_or(a, b) {
  return a | b
}
function bnOr(b) {
  var c = nbi();
  this.bitwiseTo(b, op_or, c);
  return c
}
function op_xor(a, b) {
  return a ^ b
}
function bnXor(b) {
  var c = nbi();
  this.bitwiseTo(b, op_xor, c);
  return c
}
function op_andnot(a, b) {
  return a & ~b
}
function bnAndNot(b) {
  var c = nbi();
  this.bitwiseTo(b, op_andnot, c);
  return c
}
function bnNot() {
  var b = nbi();
  for (var a = 0; a < this.t; ++a) {
    b[a] = this.DM & ~this[a]
  }
  b.t = this.t;
  b.s = ~this.s;
  return b
}
function bnShiftLeft(b) {
  var a = nbi();
  if (b < 0) {
    this.rShiftTo(- b, a)
  } else {
    this.lShiftTo(b, a)
  }
  return a
}
function bnShiftRight(b) {
  var a = nbi();
  if (b < 0) {
    this.lShiftTo(- b, a)
  } else {
    this.rShiftTo(b, a)
  }
  return a
}
function lbit(a) {
  if (a == 0) {
    return - 1
  }
  var b = 0;
  if ((a & 65535) == 0) {
    a >>= 16;
    b += 16
  }
  if ((a & 255) == 0) {
    a >>= 8;
    b += 8
  }
  if ((a & 15) == 0) {
    a >>= 4;
    b += 4
  }
  if ((a & 3) == 0) {
    a >>= 2;
    b += 2
  }
  if ((a & 1) == 0) {
    ++b
  }
  return b
}
function bnGetLowestSetBit() {
  for (var a = 0; a < this.t; ++a) {
    if (this[a] != 0) {
      return a * this.DB + lbit(this[a])
    }
  }
  if (this.s < 0) {
    return this.t * this.DB
  }
  return - 1
}
function cbit(a) {
  var b = 0;
  while (a != 0) {
    a &= a - 1; ++b
  }
  return b
}
function bnBitCount() {
  var c = 0,
    a = this.s & this.DM;
  for (var b = 0; b < this.t; ++b) {
    c += cbit(this[b] ^ a)
  }
  return c
}
function bnTestBit(b) {
  var a = Math.floor(b / this.DB);
  if (a >= this.t) {
    return (this.s != 0)
  }
  return ((this[a] & (1 << (b % this.DB))) != 0)
}
function bnpChangeBit(c, b) {
  var a = BigInteger.ONE.shiftLeft(c);
  this.bitwiseTo(a, b, a);
  return a
}
function bnSetBit(a) {
  return this.changeBit(a, op_or)
}
function bnClearBit(a) {
  return this.changeBit(a, op_andnot)
}
function bnFlipBit(a) {
  return this.changeBit(a, op_xor)
}
function bnpAddTo(d, f) {
  var e = 0,
    g = 0,
    b = Math.min(d.t, this.t);
  while (e < b) {
    g += this[e] + d[e];
    f[e++] = g & this.DM;
    g >>= this.DB
  }
  if (d.t < this.t) {
    g += d.s;
    while (e < this.t) {
      g += this[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g += this.s
  } else {
    g += this.s;
    while (e < d.t) {
      g += d[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g += d.s
  }
  f.s = (g < 0) ? -1 : 0;
  if (g > 0) {
    f[e++] = g
  } else {
    if (g < -1) {
      f[e++] = this.DV + g
    }
  }
  f.t = e;
  f.clamp()
}
function bnAdd(b) {
  var c = nbi();
  this.addTo(b, c);
  return c
}
function bnSubtract(b) {
  var c = nbi();
  this.subTo(b, c);
  return c
}
function bnMultiply(b) {
  var c = nbi();
  this.multiplyTo(b, c);
  return c
}
function bnSquare() {
  var a = nbi();
  this.squareTo(a);
  return a
}
function bnDivide(b) {
  var c = nbi();
  this.divRemTo(b, c, null);
  return c
}
function bnRemainder(b) {
  var c = nbi();
  this.divRemTo(b, null, c);
  return c
}
function bnDivideAndRemainder(b) {
  var d = nbi(),
    c = nbi();
  this.divRemTo(b, d, c);
  return new Array(d, c)
}
function bnpDMultiply(a) {
  this[this.t] = this.am(0, a - 1, this, 0, 0, this.t); ++this.t;
  this.clamp()
}
function bnpDAddOffset(b, a) {
  if (b == 0) {
    return
  }
  while (this.t <= a) {
    this[this.t++] = 0
  }
  this[a] += b;
  while (this[a] >= this.DV) {
    this[a] -= this.DV;
    if (++a >= this.t) {
      this[this.t++] = 0
    } ++this[a]
  }
}
function NullExp() { }
function nNop(a) {
  return a
}
function nMulTo(a, c, b) {
  a.multiplyTo(c, b)
}
function nSqrTo(a, b) {
  a.squareTo(b)
}
NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;
function bnPow(a) {
  return this.exp(a, new NullExp())
}
function bnpMultiplyLowerTo(b, f, e) {
  var d = Math.min(this.t + b.t, f);
  e.s = 0;
  e.t = d;
  while (d > 0) {
    e[--d] = 0
  }
  var c;
  for (c = e.t - this.t; d < c; ++d) {
    e[d + this.t] = this.am(0, b[d], e, d, 0, this.t)
  }
  for (c = Math.min(b.t, f); d < c; ++d) {
    this.am(0, b[d], e, d, 0, f - d)
  }
  e.clamp()
}
function bnpMultiplyUpperTo(b, e, d) {
  --e;
  var c = d.t = this.t + b.t - e;
  d.s = 0;
  while (--c >= 0) {
    d[c] = 0
  }
  for (c = Math.max(e - this.t, 0); c < b.t; ++c) {
    d[this.t + c - e] = this.am(e - c, b[c], d, 0, 0, this.t + c - e)
  }
  d.clamp();
  d.drShiftTo(1, d)
}
function Barrett(a) {
  this.r2 = nbi();
  this.q3 = nbi();
  BigInteger.ONE.dlShiftTo(2 * a.t, this.r2);
  this.mu = this.r2.divide(a);
  this.m = a
}
function barrettConvert(a) {
  if (a.s < 0 || a.t > 2 * this.m.t) {
    return a.mod(this.m)
  } else {
    if (a.compareTo(this.m) < 0) {
      return a
    } else {
      var b = nbi();
      a.copyTo(b);
      this.reduce(b);
      return b
    }
  }
}
function barrettRevert(a) {
  return a
}
function barrettReduce(a) {
  a.drShiftTo(this.m.t - 1, this.r2);
  if (a.t > this.m.t + 1) {
    a.t = this.m.t + 1;
    a.clamp()
  }
  this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
  this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
  while (a.compareTo(this.r2) < 0) {
    a.dAddOffset(1, this.m.t + 1)
  }
  a.subTo(this.r2, a);
  while (a.compareTo(this.m) >= 0) {
    a.subTo(this.m, a)
  }
}
function barrettSqrTo(a, b) {
  a.squareTo(b);
  this.reduce(b)
}
function barrettMulTo(a, c, b) {
  a.multiplyTo(c, b);
  this.reduce(b)
}
Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;
function bnModPow(q, f) {
  var o = q.bitLength(),
    h,
    b = nbv(1),
    v;
  if (o <= 0) {
    return b
  } else {
    if (o < 18) {
      h = 1
    } else {
      if (o < 48) {
        h = 3
      } else {
        if (o < 144) {
          h = 4
        } else {
          if (o < 768) {
            h = 5
          } else {
            h = 6
          }
        }
      }
    }
  }
  if (o < 8) {
    v = new Classic(f)
  } else {
    if (f.isEven()) {
      v = new Barrett(f)
    } else {
      v = new Montgomery(f)
    }
  }
  var p = new Array(),
    d = 3,
    s = h - 1,
    a = (1 << h) - 1;
  p[1] = v.convert(this);
  if (h > 1) {
    var A = nbi();
    v.sqrTo(p[1], A);
    while (d <= a) {
      p[d] = nbi();
      v.mulTo(A, p[d - 2], p[d]);
      d += 2
    }
  }
  var l = q.t - 1,
    x, u = true,
    c = nbi(),
    y;
  o = nbits(q[l]) - 1;
  while (l >= 0) {
    if (o >= s) {
      x = (q[l] >> (o - s)) & a
    } else {
      x = (q[l] & ((1 << (o + 1)) - 1)) << (s - o);
      if (l > 0) {
        x |= q[l - 1] >> (this.DB + o - s)
      }
    }
    d = h;
    while ((x & 1) == 0) {
      x >>= 1; --d
    }
    if ((o -= d) < 0) {
      o += this.DB; --l
    }
    if (u) {
      p[x].copyTo(b);
      u = false
    } else {
      while (d > 1) {
        v.sqrTo(b, c);
        v.sqrTo(c, b);
        d -= 2
      }
      if (d > 0) {
        v.sqrTo(b, c)
      } else {
        y = b;
        b = c;
        c = y
      }
      v.mulTo(c, p[x], b)
    }
    while (l >= 0 && (q[l] & (1 << o)) == 0) {
      v.sqrTo(b, c);
      y = b;
      b = c;
      c = y;
      if (--o < 0) {
        o = this.DB - 1; --l
      }
    }
  }
  return v.revert(b)
}
function bnGCD(c) {
  var b = (this.s < 0) ? this.negate() : this.clone();
  var h = (c.s < 0) ? c.negate() : c.clone();
  if (b.compareTo(h) < 0) {
    var e = b;
    b = h;
    h = e
  }
  var d = b.getLowestSetBit(),
    f = h.getLowestSetBit();
  if (f < 0) {
    return b
  }
  if (d < f) {
    f = d
  }
  if (f > 0) {
    b.rShiftTo(f, b);
    h.rShiftTo(f, h)
  }
  while (b.signum() > 0) {
    if ((d = b.getLowestSetBit()) > 0) {
      b.rShiftTo(d, b)
    }
    if ((d = h.getLowestSetBit()) > 0) {
      h.rShiftTo(d, h)
    }
    if (b.compareTo(h) >= 0) {
      b.subTo(h, b);
      b.rShiftTo(1, b)
    } else {
      h.subTo(b, h);
      h.rShiftTo(1, h)
    }
  }
  if (f > 0) {
    h.lShiftTo(f, h)
  }
  return h
}
function bnpModInt(e) {
  if (e <= 0) {
    return 0
  }
  var c = this.DV % e,
    b = (this.s < 0) ? e - 1 : 0;
  if (this.t > 0) {
    if (c == 0) {
      b = this[0] % e
    } else {
      for (var a = this.t - 1; a >= 0; --a) {
        b = (c * b + this[a]) % e
      }
    }
  }
  return b
}
function bnModInverse(f) {
  var j = f.isEven();
  if ((this.isEven() && j) || f.signum() == 0) {
    return BigInteger.ZERO
  }
  var i = f.clone(),
    h = this.clone();
  var g = nbv(1),
    e = nbv(0),
    l = nbv(0),
    k = nbv(1);
  while (i.signum() != 0) {
    while (i.isEven()) {
      i.rShiftTo(1, i);
      if (j) {
        if (!g.isEven() || !e.isEven()) {
          g.addTo(this, g);
          e.subTo(f, e)
        }
        g.rShiftTo(1, g)
      } else {
        if (!e.isEven()) {
          e.subTo(f, e)
        }
      }
      e.rShiftTo(1, e)
    }
    while (h.isEven()) {
      h.rShiftTo(1, h);
      if (j) {
        if (!l.isEven() || !k.isEven()) {
          l.addTo(this, l);
          k.subTo(f, k)
        }
        l.rShiftTo(1, l)
      } else {
        if (!k.isEven()) {
          k.subTo(f, k)
        }
      }
      k.rShiftTo(1, k)
    }
    if (i.compareTo(h) >= 0) {
      i.subTo(h, i);
      if (j) {
        g.subTo(l, g)
      }
      e.subTo(k, e)
    } else {
      h.subTo(i, h);
      if (j) {
        l.subTo(g, l)
      }
      k.subTo(e, k)
    }
  }
  if (h.compareTo(BigInteger.ONE) != 0) {
    return BigInteger.ZERO
  }
  if (k.compareTo(f) >= 0) {
    return k.subtract(f)
  }
  if (k.signum() < 0) {
    k.addTo(f, k)
  } else {
    return k
  }
  if (k.signum() < 0) {
    return k.add(f)
  } else {
    return k
  }
}
var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];
function bnIsProbablePrime(e) {
  var d, b = this.abs();
  if (b.t == 1 && b[0] <= lowprimes[lowprimes.length - 1]) {
    for (d = 0; d < lowprimes.length; ++d) {
      if (b[0] == lowprimes[d]) {
        return true
      }
    }
    return false
  }
  if (b.isEven()) {
    return false
  }
  d = 1;
  while (d < lowprimes.length) {
    var a = lowprimes[d],
      c = d + 1;
    while (c < lowprimes.length && a < lplim) {
      a *= lowprimes[c++]
    }
    a = b.modInt(a);
    while (d < c) {
      if (a % lowprimes[d++] == 0) {
        return false
      }
    }
  }
  return b.millerRabin(e)
}
function bnpMillerRabin(f) {
  var g = this.subtract(BigInteger.ONE);
  var c = g.getLowestSetBit();
  if (c <= 0) {
    return false
  }
  var h = g.shiftRight(c);
  f = (f + 1) >> 1;
  if (f > lowprimes.length) {
    f = lowprimes.length
  }
  var b = nbi();
  for (var e = 0; e < f; ++e) {
    b.fromInt(lowprimes[Math.floor(Math.random() * lowprimes.length)]);
    var l = b.modPow(h, this);
    if (l.compareTo(BigInteger.ONE) != 0 && l.compareTo(g) != 0) {
      var d = 1;
      while (d++ < c && l.compareTo(g) != 0) {
        l = l.modPowInt(2, this);
        if (l.compareTo(BigInteger.ONE) == 0) {
          return false
        }
      }
      if (l.compareTo(g) != 0) {
        return false
      }
    }
  }
  return true
}
BigInteger.prototype.chunkSize = bnpChunkSize;
BigInteger.prototype.toRadix = bnpToRadix;
BigInteger.prototype.fromRadix = bnpFromRadix;
BigInteger.prototype.fromNumber = bnpFromNumber;
BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
BigInteger.prototype.changeBit = bnpChangeBit;
BigInteger.prototype.addTo = bnpAddTo;
BigInteger.prototype.dMultiply = bnpDMultiply;
BigInteger.prototype.dAddOffset = bnpDAddOffset;
BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
BigInteger.prototype.modInt = bnpModInt;
BigInteger.prototype.millerRabin = bnpMillerRabin;
BigInteger.prototype.clone = bnClone;
BigInteger.prototype.intValue = bnIntValue;
BigInteger.prototype.byteValue = bnByteValue;
BigInteger.prototype.shortValue = bnShortValue;
BigInteger.prototype.signum = bnSigNum;
BigInteger.prototype.toByteArray = bnToByteArray;
BigInteger.prototype.equals = bnEquals;
BigInteger.prototype.min = bnMin;
BigInteger.prototype.max = bnMax;
BigInteger.prototype.and = bnAnd;
BigInteger.prototype.or = bnOr;
BigInteger.prototype.xor = bnXor;
BigInteger.prototype.andNot = bnAndNot;
BigInteger.prototype.not = bnNot;
BigInteger.prototype.shiftLeft = bnShiftLeft;
BigInteger.prototype.shiftRight = bnShiftRight;
BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
BigInteger.prototype.bitCount = bnBitCount;
BigInteger.prototype.testBit = bnTestBit;
BigInteger.prototype.setBit = bnSetBit;
BigInteger.prototype.clearBit = bnClearBit;
BigInteger.prototype.flipBit = bnFlipBit;
BigInteger.prototype.add = bnAdd;
BigInteger.prototype.subtract = bnSubtract;
BigInteger.prototype.multiply = bnMultiply;
BigInteger.prototype.divide = bnDivide;
BigInteger.prototype.remainder = bnRemainder;
BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
BigInteger.prototype.modPow = bnModPow;
BigInteger.prototype.modInverse = bnModInverse;
BigInteger.prototype.pow = bnPow;
BigInteger.prototype.gcd = bnGCD;
BigInteger.prototype.isProbablePrime = bnIsProbablePrime;
BigInteger.prototype.square = bnSquare;
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function Arcfour() {
  this.i = 0;
  this.j = 0;
  this.S = new Array()
}
function ARC4init(d) {
  var c, a, b;
  for (c = 0; c < 256; ++c) {
    this.S[c] = c
  }
  a = 0;
  for (c = 0; c < 256; ++c) {
    a = (a + this.S[c] + d[c % d.length]) & 255;
    b = this.S[c];
    this.S[c] = this.S[a];
    this.S[a] = b
  }
  this.i = 0;
  this.j = 0
}
function ARC4next() {
  var a;
  this.i = (this.i + 1) & 255;
  this.j = (this.j + this.S[this.i]) & 255;
  a = this.S[this.i];
  this.S[this.i] = this.S[this.j];
  this.S[this.j] = a;
  return this.S[(a + this.S[this.i]) & 255]
}
Arcfour.prototype.init = ARC4init;
Arcfour.prototype.next = ARC4next;
function prng_newstate() {
  return new Arcfour()
}
var rng_psize = 256;
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
var rng_state;
var rng_pool;
var rng_pptr;
function rng_seed_int(a) {
  rng_pool[rng_pptr++] ^= a & 255;
  rng_pool[rng_pptr++] ^= (a >> 8) & 255;
  rng_pool[rng_pptr++] ^= (a >> 16) & 255;
  rng_pool[rng_pptr++] ^= (a >> 24) & 255;
  if (rng_pptr >= rng_psize) {
    rng_pptr -= rng_psize
  }
}
function rng_seed_time() {
  rng_seed_int(new Date().getTime())
}
if (rng_pool == null) {
  rng_pool = new Array();
  rng_pptr = 0;
  var t;
  if (window2.crypto && window2.crypto.getRandomValues) {
    var ua = new Uint8Array(32);
    window2.crypto.getRandomValues(ua);
    for (t = 0; t < 32; ++t) {
      rng_pool[rng_pptr++] = ua[t]
    }
  }
  if (navigator2.appName == "Netscape" && navigator2.appVersion < "5" && window2.crypto && window2.crypto.random) {
    var z = window2.crypto.random(32);
    for (t = 0; t < z.length; ++t) {
      rng_pool[rng_pptr++] = z.charCodeAt(t) & 255
    }
  }
  while (rng_pptr < rng_psize) {
    t = Math.floor(65536 * Math.random());
    rng_pool[rng_pptr++] = t >>> 8;
    rng_pool[rng_pptr++] = t & 255
  }
  rng_pptr = 0;
  rng_seed_time()
}
function rng_get_byte() {
  if (rng_state == null) {
    rng_seed_time();
    rng_state = prng_newstate();
    rng_state.init(rng_pool);
    for (rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr) {
      rng_pool[rng_pptr] = 0
    }
    rng_pptr = 0
  }
  return rng_state.next()
}
function rng_get_bytes(b) {
  var a;
  for (a = 0; a < b.length; ++a) {
    b[a] = rng_get_byte()
  }
}
function SecureRandom() { }
SecureRandom.prototype.nextBytes = rng_get_bytes;
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function parseBigInt(b, a) {
  return new BigInteger(b, a)
}
function linebrk(c, d) {
  var a = "";
  var b = 0;
  while (b + d < c.length) {
    a += c.substring(b, b + d) + "\n";
    b += d
  }
  return a + c.substring(b, c.length)
}
function byte2Hex(a) {
  if (a < 16) {
    return "0" + a.toString(16)
  } else {
    return a.toString(16)
  }
}
function pkcs1pad2(e, h) {
  if (h < e.length + 11) {
    console.log("Message too long for RSA")
    return null
  }
  var g = new Array();
  var d = e.length - 1;
  while (d >= 0 && h > 0) {
    var f = e[d--];
    if (f < 128) {
      g[--h] = f
    } else {
      if ((f > 127) && (f < 2048)) {
        g[--h] = (f & 63) | 128;
        g[--h] = (f >> 6) | 192
      } else {
        g[--h] = (f & 63) | 128;
        g[--h] = ((f >> 6) & 63) | 128;
        g[--h] = (f >> 12) | 224
      }
    }
  }
  g[--h] = 0;
  var b = new SecureRandom();
  var a = new Array();
  while (h > 2) {
    a[0] = 0;
    while (a[0] == 0) {
      b.nextBytes(a)
    }
    g[--h] = a[0]
  }
  g[--h] = 2;
  g[--h] = 0;
  return new BigInteger(g)
}
function oaep_mgf1_arr(c, a, e) {
  var b = "",
    d = 0;
  while (b.length < a) {
    b += e(String.fromCharCode.apply(String, c.concat([(d & 4278190080) >> 24, (d & 16711680) >> 16, (d & 65280) >> 8, d & 255])));
    d += 1
  }
  return b
}
function oaep_pad(q, a, f, l) {
  var c = KJUR.crypto.MessageDigest;
  var o = KJUR.crypto.Util;
  var b = null;
  if (!f) {
    f = "sha1"
  }
  if (typeof f === "string") {
    b = c.getCanonicalAlgName(f);
    l = c.getHashLength(b);
    f = function (i) {
      return hextorstr(o.hashString(i, b))
    }
  }
  if (q.length + 2 * l + 2 > a) {
    throw "Message too long for RSA"
  }
  var k = "",
    e;
  for (e = 0; e < a - q.length - 2 * l - 2; e += 1) {
    k += "\x00"
  }
  var h = f("") + k + "\x01" + q;
  var g = new Array(l);
  new SecureRandom().nextBytes(g);
  var j = oaep_mgf1_arr(g, h.length, f);
  var p = [];
  for (e = 0; e < h.length; e += 1) {
    p[e] = h.charCodeAt(e) ^ j.charCodeAt(e)
  }
  var m = oaep_mgf1_arr(p, g.length, f);
  var d = [0];
  for (e = 0; e < g.length; e += 1) {
    d[e + 1] = g[e] ^ m.charCodeAt(e)
  }
  return new BigInteger(d.concat(p))
}
function RSAKey() {
  this.n = null;
  this.e = 0;
  this.d = null;
  this.p = null;
  this.q = null;
  this.dmp1 = null;
  this.dmq1 = null;
  this.coeff = null
}
function RSASetPublic(b, a) {
  this.isPublic = true;
  this.isPrivate = false;
  if (typeof b !== "string") {
    this.n = b;
    this.e = a
  } else {
    if (b != null && a != null && b.length > 0 && a.length > 0) {
      this.n = parseBigInt(b, 16);
      this.e = parseInt(a, 16)
    } else {
      throw "Invalid RSA public key"
    }
  }
}
function RSADoPublic(a) {
  return a.modPowInt(this.e, this.n)
}
function RSAEncrypt(d) {
  var a = pkcs1pad2(d, (this.n.bitLength() + 7) >> 3);
  if (a == null) {
    return null
  }
  var e = this.doPublic(a);
  if (e == null) {
    return null
  }
  var b = e.toString(16);
  if ((b.length & 1) == 0) {
    return b
  } else {
    return "0" + b
  }
}

function RSAEncryptLong(d) {
  var k = this;
  var maxLength = (((k.n.bitLength() + 7) >> 3) - 11);

  try {
    var lt = "";
    var ct = "";

    if (d.length > maxLength) {
      lt = d.match(/.{1,50}/g);
      lt.forEach(function (entry) {
        var t1 = k.encrypt(entry);
        ct += t1;
      });
      return hex2b64(ct);
    }
    var t = k.encrypt(d);
    var y = hex2b64(t);
    return y;
  } catch (ex) {
    return false;
  }
}
function RSAEncryptOAEP(f, e, b) {
  var a = oaep_pad(f, (this.n.bitLength() + 7) >> 3, e, b);
  if (a == null) {
    return null
  }
  var g = this.doPublic(a);
  if (g == null) {
    return null
  }
  var d = g.toString(16);
  if ((d.length & 1) == 0) {
    return d
  } else {
    return "0" + d
  }
}
RSAKey.prototype.doPublic = RSADoPublic;
RSAKey.prototype.setPublic = RSASetPublic;
RSAKey.prototype.encrypt = RSAEncrypt;
RSAKey.prototype.encryptOAEP = RSAEncryptOAEP;
RSAKey.prototype.encryptLong = RSAEncryptLong;
RSAKey.prototype.type = "RSA";
/*! (c) Tom Wu | http://www-cs-students.stanford.edu/~tjw/jsbn/
 */
function pkcs1unpad2(g, j) {
  var a = g.toByteArray();
  var f = 0;
  while (f < a.length && a[f] == 0) {
    ++f
  }
  if (a.length - f != j - 1 || a[f] != 2) {
    return null
  } ++f;
  while (a[f] != 0) {
    if (++f >= a.length) {
      return null
    }
  }
  var e = "";
  while (++f < a.length) {
    var h = a[f] & 255;
    if (h < 128) {
      e += String.fromCharCode(h)
    } else {
      if ((h > 191) && (h < 224)) {
        e += String.fromCharCode(((h & 31) << 6) | (a[f + 1] & 63)); ++f
      } else {
        e += String.fromCharCode(((h & 15) << 12) | ((a[f + 1] & 63) << 6) | (a[f + 2] & 63));
        f += 2
      }
    }
  }
  return e
}
function oaep_mgf1_str(c, a, e) {
  var b = "",
    d = 0;
  while (b.length < a) {
    b += e(c + String.fromCharCode.apply(String, [(d & 4278190080) >> 24, (d & 16711680) >> 16, (d & 65280) >> 8, d & 255]));
    d += 1
  }
  return b
}
function oaep_unpad(o, b, g, p) {
  var e = KJUR.crypto.MessageDigest;
  var r = KJUR.crypto.Util;
  var c = null;
  if (!g) {
    g = "sha1"
  }
  if (typeof g === "string") {
    c = e.getCanonicalAlgName(g);
    p = e.getHashLength(c);
    g = function (d) {
      return hextorstr(r.hashString(d, c))
    }
  }
  o = o.toByteArray();
  var h;
  for (h = 0; h < o.length; h += 1) {
    o[h] &= 255
  }
  while (o.length < b) {
    o.unshift(0)
  }
  o = String.fromCharCode.apply(String, o);
  if (o.length < 2 * p + 2) {
    throw "Cipher too short"
  }
  var f = o.substr(1, p);
  var s = o.substr(p + 1);
  var q = oaep_mgf1_str(s, p, g);
  var k = [],
    h;
  for (h = 0; h < f.length; h += 1) {
    k[h] = f.charCodeAt(h) ^ q.charCodeAt(h)
  }
  var l = oaep_mgf1_str(String.fromCharCode.apply(String, k), o.length - p, g);
  var j = [];
  for (h = 0; h < s.length; h += 1) {
    j[h] = s.charCodeAt(h) ^ l.charCodeAt(h)
  }
  j = String.fromCharCode.apply(String, j);
  if (j.substr(0, p) !== g("")) {
    throw "Hash mismatch"
  }
  j = j.substr(p);
  var a = j.indexOf("\x01");
  var m = (a != -1) ? j.substr(0, a).lastIndexOf("\x00") : -1;
  if (m + 1 != a) {
    throw "Malformed data"
  }
  return j.substr(a + 1)
}
function RSASetPrivate(c, a, b) {
  this.isPrivate = true;
  if (typeof c !== "string") {
    this.n = c;
    this.e = a;
    this.d = b
  } else {
    if (c != null && a != null && c.length > 0 && a.length > 0) {
      this.n = parseBigInt(c, 16);
      this.e = parseInt(a, 16);
      this.d = parseBigInt(b, 16)
    } else {
      alert("Invalid RSA private key")
    }
  }
}
function RSASetPrivateEx(g, d, e, c, b, a, h, f) {
  this.isPrivate = true;
  this.isPublic = false;
  if (g == null) {
    throw "RSASetPrivateEx N == null"
  }
  if (d == null) {
    throw "RSASetPrivateEx E == null"
  }
  if (g.length == 0) {
    throw "RSASetPrivateEx N.length == 0"
  }
  if (d.length == 0) {
    throw "RSASetPrivateEx E.length == 0"
  }
  if (g != null && d != null && g.length > 0 && d.length > 0) {
    this.n = parseBigInt(g, 16);
    this.e = parseInt(d, 16);
    this.d = parseBigInt(e, 16);
    this.p = parseBigInt(c, 16);
    this.q = parseBigInt(b, 16);
    this.dmp1 = parseBigInt(a, 16);
    this.dmq1 = parseBigInt(h, 16);
    this.coeff = parseBigInt(f, 16)
  } else {
    alert("Invalid RSA private key in RSASetPrivateEx")
  }
}
function RSAGenerate(b, i) {
  var a = new SecureRandom();
  var f = b >> 1;
  this.e = parseInt(i, 16);
  var c = new BigInteger(i, 16);
  for (; ;) {
    for (; ;) {
      this.p = new BigInteger(b - f, 1, a);
      if (this.p.subtract(BigInteger.ONE).gcd(c).compareTo(BigInteger.ONE) == 0 && this.p.isProbablePrime(10)) {
        break
      }
    }
    for (; ;) {
      this.q = new BigInteger(f, 1, a);
      if (this.q.subtract(BigInteger.ONE).gcd(c).compareTo(BigInteger.ONE) == 0 && this.q.isProbablePrime(10)) {
        break
      }
    }
    if (this.p.compareTo(this.q) <= 0) {
      var h = this.p;
      this.p = this.q;
      this.q = h
    }
    var g = this.p.subtract(BigInteger.ONE);
    var d = this.q.subtract(BigInteger.ONE);
    var e = g.multiply(d);
    if (e.gcd(c).compareTo(BigInteger.ONE) == 0) {
      this.n = this.p.multiply(this.q);
      this.d = c.modInverse(e);
      this.dmp1 = this.d.mod(g);
      this.dmq1 = this.d.mod(d);
      this.coeff = this.q.modInverse(this.p);
      break
    }
  }
  this.isPrivate = true
}
function RSADoPrivate(a) {
  if (this.p == null || this.q == null) {
    return a.modPow(this.d, this.n)
  }
  var c = a.mod(this.p).modPow(this.dmp1, this.p);
  var b = a.mod(this.q).modPow(this.dmq1, this.q);
  while (c.compareTo(b) < 0) {
    c = c.add(this.p)
  }
  return c.subtract(b).multiply(this.coeff).mod(this.p).multiply(this.q).add(b)
}
function RSADecrypt(b) {
  var d = parseBigInt(b, 16);
  var a = this.doPrivate(d);
  if (a == null) {
    return null
  }
  return pkcs1unpad2(a, (this.n.bitLength() + 7) >> 3)
}
function RSADecryptOAEP(e, d, b) {
  var f = parseBigInt(e, 16);
  var a = this.doPrivate(f);
  if (a == null) {
    return null
  }
  return oaep_unpad(a, (this.n.bitLength() + 7) >> 3, d, b)
}
RSAKey.prototype.doPrivate = RSADoPrivate;
RSAKey.prototype.setPrivate = RSASetPrivate;
RSAKey.prototype.setPrivateEx = RSASetPrivateEx;
RSAKey.prototype.generate = RSAGenerate;
RSAKey.prototype.decrypt = RSADecrypt;
RSAKey.prototype.decryptOAEP = RSADecryptOAEP;



/*! keyutil-1.0.15.js (c) 2013-2017 Kenji Urushima | kjur.github.com/jsrsasign/license
 */
var KEYUTIL = function () {
  var d = function (p, r, q) {
    return k(CryptoJS.AES, p, r, q)
  };
  var e = function (p, r, q) {
    return k(CryptoJS.TripleDES, p, r, q)
  };
  var a = function (p, r, q) {
    return k(CryptoJS.DES, p, r, q)
  };
  var k = function (s, x, u, q) {
    var r = CryptoJS.enc.Hex.parse(x);
    var w = CryptoJS.enc.Hex.parse(u);
    var p = CryptoJS.enc.Hex.parse(q);
    var t = {};
    t.key = w;
    t.iv = p;
    t.ciphertext = r;
    var v = s.decrypt(t, w, {
      iv: p
    });
    return CryptoJS.enc.Hex.stringify(v)
  };
  var l = function (p, r, q) {
    return g(CryptoJS.AES, p, r, q)
  };
  var o = function (p, r, q) {
    return g(CryptoJS.TripleDES, p, r, q)
  };
  var f = function (p, r, q) {
    return g(CryptoJS.DES, p, r, q)
  };
  var g = function (t, y, v, q) {
    var s = CryptoJS.enc.Hex.parse(y);
    var x = CryptoJS.enc.Hex.parse(v);
    var p = CryptoJS.enc.Hex.parse(q);
    var w = t.encrypt(s, x, {
      iv: p
    });
    var r = CryptoJS.enc.Hex.parse(w.toString());
    var u = CryptoJS.enc.Base64.stringify(r);
    return u
  };
  var i = {
    "AES-256-CBC": {
      proc: d,
      eproc: l,
      keylen: 32,
      ivlen: 16
    },
    "AES-192-CBC": {
      proc: d,
      eproc: l,
      keylen: 24,
      ivlen: 16
    },
    "AES-128-CBC": {
      proc: d,
      eproc: l,
      keylen: 16,
      ivlen: 16
    },
    "DES-EDE3-CBC": {
      proc: e,
      eproc: o,
      keylen: 24,
      ivlen: 8
    },
    "DES-CBC": {
      proc: a,
      eproc: f,
      keylen: 8,
      ivlen: 8
    }
  };
  var c = function (p) {
    return i[p]["proc"]
  };
  var m = function (p) {
    var r = CryptoJS.lib.WordArray.random(p);
    var q = CryptoJS.enc.Hex.stringify(r);
    return q
  };
  var n = function (v) {
    var w = {};
    var q = v.match(new RegExp("DEK-Info: ([^,]+),([0-9A-Fa-f]+)", "m"));
    if (q) {
      w.cipher = q[1];
      w.ivsalt = q[2]
    }
    var p = v.match(new RegExp("-----BEGIN ([A-Z]+) PRIVATE KEY-----"));
    if (p) {
      w.type = p[1]
    }
    var u = -1;
    var x = 0;
    if (v.indexOf("\r\n\r\n") != -1) {
      u = v.indexOf("\r\n\r\n");
      x = 2
    }
    if (v.indexOf("\n\n") != -1) {
      u = v.indexOf("\n\n");
      x = 1
    }
    var t = v.indexOf("-----END");
    if (u != -1 && t != -1) {
      var r = v.substring(u + x * 2, t - x);
      r = r.replace(/\s+/g, "");
      w.data = r
    }
    return w
  };
  var j = function (q, y, p) {
    var v = p.substring(0, 16);
    var t = CryptoJS.enc.Hex.parse(v);
    var r = CryptoJS.enc.Utf8.parse(y);
    var u = i[q]["keylen"] + i[q]["ivlen"];
    var x = "";
    var w = null;
    for (; ;) {
      var s = CryptoJS.algo.MD5.create();
      if (w != null) {
        s.update(w)
      }
      s.update(r);
      s.update(t);
      w = s.finalize();
      x = x + CryptoJS.enc.Hex.stringify(w);
      if (x.length >= u * 2) {
        break
      }
    }
    var z = {};
    z.keyhex = x.substr(0, i[q]["keylen"] * 2);
    z.ivhex = x.substr(i[q]["keylen"] * 2, i[q]["ivlen"] * 2);
    return z
  };
  var b = function (p, v, r, w) {
    var s = CryptoJS.enc.Base64.parse(p);
    var q = CryptoJS.enc.Hex.stringify(s);
    var u = i[v]["proc"];
    var t = u(q, r, w);
    return t
  };
  var h = function (p, s, q, u) {
    var r = i[s]["eproc"];
    var t = r(p, q, u);
    return t
  };
  return {
    version: "1.0.0",
    getHexFromPEM: function (p, q) {
      return ASN1HEX.pemToHex(p, q)
    },
    getDecryptedKeyHexByKeyIV: function (q, t, s, r) {
      var p = c(t);
      return p(q, s, r)
    },
    parsePKCS5PEM: function (p) {
      return n(p)
    },
    getKeyAndUnusedIvByPasscodeAndIvsalt: function (q, p, r) {
      return j(q, p, r)
    },
    decryptKeyB64: function (p, r, q, s) {
      return b(p, r, q, s)
    },
    getDecryptedKeyHex: function (y, x) {
      var q = n(y);
      var t = q.type;
      var r = q.cipher;
      var p = q.ivsalt;
      var s = q.data;
      var w = j(r, x, p);
      var v = w.keyhex;
      var u = b(s, r, v, p);
      return u
    },
    getRSAKeyFromEncryptedPKCS5PEM: function (r, q) {
      var s = this.getDecryptedKeyHex(r, q);
      var p = new RSAKey();
      p.readPrivateKeyFromASN1HexString(s);
      return p
    },
    getEncryptedPKCS5PEMFromPrvKeyHex: function (x, s, A, t, r) {
      var p = "";
      if (typeof t == "undefined" || t == null) {
        t = "AES-256-CBC"
      }
      if (typeof i[t] == "undefined") {
        throw "KEYUTIL unsupported algorithm: " + t
      }
      if (typeof r == "undefined" || r == null) {
        var v = i[t]["ivlen"];
        var u = m(v);
        r = u.toUpperCase()
      }
      var z = j(t, A, r);
      var y = z.keyhex;
      var w = h(s, t, y, r);
      var q = w.replace(/(.{64})/g, "$1\r\n");
      var p = "-----BEGIN " + x + " PRIVATE KEY-----\r\n";
      p += "Proc-Type: 4,ENCRYPTED\r\n";
      p += "DEK-Info: " + t + "," + r + "\r\n";
      p += "\r\n";
      p += q;
      p += "\r\n-----END " + x + " PRIVATE KEY-----\r\n";
      return p
    },
    getEncryptedPKCS5PEMFromRSAKey: function (D, E, r, t) {
      var B = new KJUR.asn1.DERInteger({
        "int": 0
      });
      var w = new KJUR.asn1.DERInteger({
        bigint: D.n
      });
      var A = new KJUR.asn1.DERInteger({
        "int": D.e
      });
      var C = new KJUR.asn1.DERInteger({
        bigint: D.d
      });
      var u = new KJUR.asn1.DERInteger({
        bigint: D.p
      });
      var s = new KJUR.asn1.DERInteger({
        bigint: D.q
      });
      var z = new KJUR.asn1.DERInteger({
        bigint: D.dmp1
      });
      var v = new KJUR.asn1.DERInteger({
        bigint: D.dmq1
      });
      var y = new KJUR.asn1.DERInteger({
        bigint: D.coeff
      });
      var F = new KJUR.asn1.DERSequence({
        array: [B, w, A, C, u, s, z, v, y]
      });
      var x = F.getEncodedHex();
      return this.getEncryptedPKCS5PEMFromPrvKeyHex("RSA", x, E, r, t)
    },
    newEncryptedPKCS5PEM: function (p, q, t, u) {
      if (typeof q == "undefined" || q == null) {
        q = 1024
      }
      if (typeof t == "undefined" || t == null) {
        t = "10001"
      }
      var r = new RSAKey();
      r.generate(q, t);
      var s = null;
      if (typeof u == "undefined" || u == null) {
        s = this.getEncryptedPKCS5PEMFromRSAKey(r, p)
      } else {
        s = this.getEncryptedPKCS5PEMFromRSAKey(r, p, u)
      }
      return s
    },
    getRSAKeyFromPlainPKCS8PEM: function (r) {
      if (r.match(/ENCRYPTED/)) {
        throw "pem shall be not ENCRYPTED"
      }
      var q = ASN1HEX.pemToHex(r, "PRIVATE KEY");
      var p = this.getRSAKeyFromPlainPKCS8Hex(q);
      return p
    },
    getRSAKeyFromPlainPKCS8Hex: function (q) {
      var p = new RSAKey();
      p.readPKCS8PrvKeyHex(q);
      return p
    },
    parseHexOfEncryptedPKCS8: function (w) {
      var s = {};
      var r = ASN1HEX.getPosArrayOfChildren_AtObj(w, 0);
      if (r.length != 2) {
        throw "malformed format: SEQUENCE(0).items != 2: " + r.length
      }
      s.ciphertext = ASN1HEX.getHexOfV_AtObj(w, r[1]);
      var y = ASN1HEX.getPosArrayOfChildren_AtObj(w, r[0]);
      if (y.length != 2) {
        throw "malformed format: SEQUENCE(0.0).items != 2: " + y.length
      }
      if (ASN1HEX.getHexOfV_AtObj(w, y[0]) != "2a864886f70d01050d") {
        throw "this only supports pkcs5PBES2"
      }
      var p = ASN1HEX.getPosArrayOfChildren_AtObj(w, y[1]);
      if (y.length != 2) {
        throw "malformed format: SEQUENCE(0.0.1).items != 2: " + p.length
      }
      var q = ASN1HEX.getPosArrayOfChildren_AtObj(w, p[1]);
      if (q.length != 2) {
        throw "malformed format: SEQUENCE(0.0.1.1).items != 2: " + q.length
      }
      if (ASN1HEX.getHexOfV_AtObj(w, q[0]) != "2a864886f70d0307") {
        throw "this only supports TripleDES"
      }
      s.encryptionSchemeAlg = "TripleDES";
      s.encryptionSchemeIV = ASN1HEX.getHexOfV_AtObj(w, q[1]);
      var t = ASN1HEX.getPosArrayOfChildren_AtObj(w, p[0]);
      if (t.length != 2) {
        throw "malformed format: SEQUENCE(0.0.1.0).items != 2: " + t.length
      }
      if (ASN1HEX.getHexOfV_AtObj(w, t[0]) != "2a864886f70d01050c") {
        throw "this only supports pkcs5PBKDF2"
      }
      var x = ASN1HEX.getPosArrayOfChildren_AtObj(w, t[1]);
      if (x.length < 2) {
        throw "malformed format: SEQUENCE(0.0.1.0.1).items < 2: " + x.length
      }
      s.pbkdf2Salt = ASN1HEX.getHexOfV_AtObj(w, x[0]);
      var u = ASN1HEX.getHexOfV_AtObj(w, x[1]);
      try {
        s.pbkdf2Iter = parseInt(u, 16)
      } catch (v) {
        throw "malformed format pbkdf2Iter: " + u
      }
      return s
    },
    getPBKDF2KeyHexFromParam: function (u, p) {
      var t = CryptoJS.enc.Hex.parse(u.pbkdf2Salt);
      var q = u.pbkdf2Iter;
      var s = CryptoJS.PBKDF2(p, t, {
        keySize: 192 / 32,
        iterations: q
      });
      var r = CryptoJS.enc.Hex.stringify(s);
      return r
    },
    getPlainPKCS8HexFromEncryptedPKCS8PEM: function (x, y) {
      var r = ASN1HEX.pemToHex(x, "ENCRYPTED PRIVATE KEY");
      var p = this.parseHexOfEncryptedPKCS8(r);
      var u = KEYUTIL.getPBKDF2KeyHexFromParam(p, y);
      var v = {};
      v.ciphertext = CryptoJS.enc.Hex.parse(p.ciphertext);
      var t = CryptoJS.enc.Hex.parse(u);
      var s = CryptoJS.enc.Hex.parse(p.encryptionSchemeIV);
      var w = CryptoJS.TripleDES.decrypt(v, t, {
        iv: s
      });
      var q = CryptoJS.enc.Hex.stringify(w);
      return q
    },
    getRSAKeyFromEncryptedPKCS8PEM: function (s, r) {
      var q = this.getPlainPKCS8HexFromEncryptedPKCS8PEM(s, r);
      var p = this.getRSAKeyFromPlainPKCS8Hex(q);
      return p
    },
    getKeyFromEncryptedPKCS8PEM: function (s, q) {
      var p = this.getPlainPKCS8HexFromEncryptedPKCS8PEM(s, q);
      var r = this.getKeyFromPlainPrivatePKCS8Hex(p);
      return r
    },
    parsePlainPrivatePKCS8Hex: function (s) {
      var q = {};
      q.algparam = null;
      if (s.substr(0, 2) != "30") {
        throw "malformed plain PKCS8 private key(code:001)"
      }
      var r = ASN1HEX.getPosArrayOfChildren_AtObj(s, 0);
      if (r.length != 3) {
        throw "malformed plain PKCS8 private key(code:002)"
      }
      if (s.substr(r[1], 2) != "30") {
        throw "malformed PKCS8 private key(code:003)"
      }
      var p = ASN1HEX.getPosArrayOfChildren_AtObj(s, r[1]);
      if (p.length != 2) {
        throw "malformed PKCS8 private key(code:004)"
      }
      if (s.substr(p[0], 2) != "06") {
        throw "malformed PKCS8 private key(code:005)"
      }
      q.algoid = ASN1HEX.getHexOfV_AtObj(s, p[0]);
      if (s.substr(p[1], 2) == "06") {
        q.algparam = ASN1HEX.getHexOfV_AtObj(s, p[1])
      }
      if (s.substr(r[2], 2) != "04") {
        throw "malformed PKCS8 private key(code:006)"
      }
      q.keyidx = ASN1HEX.getStartPosOfV_AtObj(s, r[2]);
      return q
    },
    getKeyFromPlainPrivatePKCS8PEM: function (q) {
      var p = ASN1HEX.pemToHex(q, "PRIVATE KEY");
      var r = this.getKeyFromPlainPrivatePKCS8Hex(p);
      return r
    },
    getKeyFromPlainPrivatePKCS8Hex: function (p) {
      var q = this.parsePlainPrivatePKCS8Hex(p);
      var r;
      if (q.algoid == "2a864886f70d010101") {
        r = new RSAKey()
      } else {
        if (q.algoid == "2a8648ce380401") {
          r = new KJUR.crypto.DSA()
        } else {
          if (q.algoid == "2a8648ce3d0201") {
            r = new KJUR.crypto.ECDSA()
          } else {
            throw "unsupported private key algorithm"
          }
        }
      }
      r.readPKCS8PrvKeyHex(p);
      return r
    },
    getRSAKeyFromPublicPKCS8PEM: function (q) {
      var r = ASN1HEX.pemToHex(q, "PUBLIC KEY");
      var p = this.getRSAKeyFromPublicPKCS8Hex(r);
      return p
    },
    getKeyFromPublicPKCS8PEM: function (q) {
      var r = ASN1HEX.pemToHex(q, "PUBLIC KEY");
      var p = this.getKeyFromPublicPKCS8Hex(r);
      return p
    },
    getKeyFromPublicPKCS8Hex: function (q) {
      var p;
      var r = ASN1HEX.getVbyList(q, 0, [0, 0], "06");
      if (r === "2a864886f70d010101") {
        p = new RSAKey()
      } else {
        if (r === "2a8648ce380401") {
          p = new KJUR.crypto.DSA()
        } else {
          if (r === "2a8648ce3d0201") {
            p = new KJUR.crypto.ECDSA()
          } else {
            throw "unsupported PKCS#8 public key hex"
          }
        }
      }
      p.readPKCS8PubKeyHex(q);
      return p
    },
    parsePublicRawRSAKeyHex: function (r) {
      var p = {};
      if (r.substr(0, 2) != "30") {
        throw "malformed RSA key(code:001)"
      }
      var q = ASN1HEX.getPosArrayOfChildren_AtObj(r, 0);
      if (q.length != 2) {
        throw "malformed RSA key(code:002)"
      }
      if (r.substr(q[0], 2) != "02") {
        throw "malformed RSA key(code:003)"
      }
      p.n = ASN1HEX.getHexOfV_AtObj(r, q[0]);
      if (r.substr(q[1], 2) != "02") {
        throw "malformed RSA key(code:004)"
      }
      p.e = ASN1HEX.getHexOfV_AtObj(r, q[1]);
      return p
    },
    parsePrivateRawRSAKeyHexAtObj: function (q, u) {
      var t = ASN1HEX;
      var r = t.getHexOfV_AtObj;
      var s = t.getDecendantIndexByNthList(q, 0, [2, 0]);
      var p = t.getPosArrayOfChildren_AtObj(q, s);
      if (p.length !== 9) {
        throw "malformed PKCS#8 plain RSA private key"
      }
      u.key = {};
      u.key.n = r(q, p[1]);
      u.key.e = r(q, p[2]);
      u.key.d = r(q, p[3]);
      u.key.p = r(q, p[4]);
      u.key.q = r(q, p[5]);
      u.key.dp = r(q, p[6]);
      u.key.dq = r(q, p[7]);
      u.key.co = r(q, p[8])
    },
    parsePrivateRawECKeyHexAtObj: function (p, t) {
      var s = ASN1HEX;
      var q = t.keyidx;
      var r = new KJUR.crypto.ECDSA();
      r.readPKCS8PrvKeyHex(p);
      t.key = r.prvKeyHex;
      t.pubkey = r.pubKeyHex
    },
    parsePublicPKCS8Hex: function (s) {
      var q = {};
      q.algparam = null;
      var r = ASN1HEX.getPosArrayOfChildren_AtObj(s, 0);
      if (r.length != 2) {
        throw "outer DERSequence shall have 2 elements: " + r.length
      }
      var t = r[0];
      if (s.substr(t, 2) != "30") {
        throw "malformed PKCS8 public key(code:001)"
      }
      var p = ASN1HEX.getPosArrayOfChildren_AtObj(s, t);
      if (p.length != 2) {
        throw "malformed PKCS8 public key(code:002)"
      }
      if (s.substr(p[0], 2) != "06") {
        throw "malformed PKCS8 public key(code:003)"
      }
      q.algoid = ASN1HEX.getHexOfV_AtObj(s, p[0]);
      if (s.substr(p[1], 2) == "06") {
        q.algparam = ASN1HEX.getHexOfV_AtObj(s, p[1])
      } else {
        if (s.substr(p[1], 2) == "30") {
          q.algparam = {};
          q.algparam.p = ASN1HEX.getVbyList(s, p[1], [0], "02");
          q.algparam.q = ASN1HEX.getVbyList(s, p[1], [1], "02");
          q.algparam.g = ASN1HEX.getVbyList(s, p[1], [2], "02")
        }
      }
      if (s.substr(r[1], 2) != "03") {
        throw "malformed PKCS8 public key(code:004)"
      }
      q.key = ASN1HEX.getHexOfV_AtObj(s, r[1]).substr(2);
      return q
    },
    getRSAKeyFromPublicPKCS8Hex: function (p) {
      var q = new RSAKey();
      q.readPKCS8PubKeyHex(p);
      return q
    },
  }
}();
KEYUTIL.getKey = function (i, f, j) {
  if (typeof RSAKey != "undefined" && i instanceof RSAKey) {
    return i
  }
  if (typeof KJUR.crypto.ECDSA != "undefined" && i instanceof KJUR.crypto.ECDSA) {
    return i
  }
  if (typeof KJUR.crypto.DSA != "undefined" && i instanceof KJUR.crypto.DSA) {
    return i
  }
  if (i.curve !== undefined && i.xy !== undefined && i.d === undefined) {
    return new KJUR.crypto.ECDSA({
      pub: i.xy,
      curve: i.curve
    })
  }
  if (i.curve !== undefined && i.d !== undefined) {
    return new KJUR.crypto.ECDSA({
      prv: i.d,
      curve: i.curve
    })
  }
  if (i.kty === undefined && i.n !== undefined && i.e !== undefined && i.d === undefined) {
    var D = new RSAKey();
    D.setPublic(i.n, i.e);
    return D
  }
  if (i.kty === undefined && i.n !== undefined && i.e !== undefined && i.d !== undefined && i.p !== undefined && i.q !== undefined && i.dp !== undefined && i.dq !== undefined && i.co !== undefined && i.qi === undefined) {
    var D = new RSAKey();
    D.setPrivateEx(i.n, i.e, i.d, i.p, i.q, i.dp, i.dq, i.co);
    return D
  }
  if (i.kty === undefined && i.n !== undefined && i.e !== undefined && i.d !== undefined && i.p === undefined) {
    var D = new RSAKey();
    D.setPrivate(i.n, i.e, i.d);
    return D
  }
  if (i.p !== undefined && i.q !== undefined && i.g !== undefined && i.y !== undefined && i.x === undefined) {
    var D = new KJUR.crypto.DSA();
    D.setPublic(i.p, i.q, i.g, i.y);
    return D
  }
  if (i.p !== undefined && i.q !== undefined && i.g !== undefined && i.y !== undefined && i.x !== undefined) {
    var D = new KJUR.crypto.DSA();
    D.setPrivate(i.p, i.q, i.g, i.y, i.x);
    return D
  }
  if (i.kty === "RSA" && i.n !== undefined && i.e !== undefined && i.d === undefined) {
    var D = new RSAKey();
    D.setPublic(b64utohex(i.n), b64utohex(i.e));
    return D
  }
  if (i.kty === "RSA" && i.n !== undefined && i.e !== undefined && i.d !== undefined && i.p !== undefined && i.q !== undefined && i.dp !== undefined && i.dq !== undefined && i.qi !== undefined) {

    var D = new RSAKey();
    D.setPrivateEx(b64utohex(i.n), b64utohex(i.e), b64utohex(i.d), b64utohex(i.p), b64utohex(i.q), b64utohex(i.dp), b64utohex(i.dq), b64utohex(i.qi));
    return D
  }
  if (i.kty === "RSA" && i.n !== undefined && i.e !== undefined && i.d !== undefined) {

    var D = new RSAKey();
    D.setPrivate(b64utohex(i.n), b64utohex(i.e), b64utohex(i.d));
    return D
  }
  if (i.kty === "EC" && i.crv !== undefined && i.x !== undefined && i.y !== undefined && i.d === undefined) {
    var e = new KJUR.crypto.ECDSA({
      curve: i.crv
    });
    var n = e.ecparams.keylen / 4;
    var t = ("0000000000" + b64utohex(i.x)).slice(- n);
    var r = ("0000000000" + b64utohex(i.y)).slice(- n);
    var o = "04" + t + r;
    e.setPublicKeyHex(o);
    return e
  }
  if (i.kty === "EC" && i.crv !== undefined && i.x !== undefined && i.y !== undefined && i.d !== undefined) {
    var e = new KJUR.crypto.ECDSA({
      curve: i.crv
    });
    var n = e.ecparams.keylen / 4;
    var t = ("0000000000" + b64utohex(i.x)).slice(- n);
    var r = ("0000000000" + b64utohex(i.y)).slice(- n);
    var o = "04" + t + r;
    var b = ("0000000000" + b64utohex(i.d)).slice(- n);
    e.setPublicKeyHex(o);
    e.setPrivateKeyHex(b);
    return e
  }
  if (j === "pkcs5prv") {

    var A = i,
      w = ASN1HEX,
      C, D;
    C = w.getPosArrayOfChildren_AtObj(A, 0);

    if (C.length === 9) {
      D = new RSAKey();
      D.readPrivateKeyFromASN1HexString(i)
    } else {
      if (C.length === 6) {
        D = new KJUR.crypto.DSA();
        D.readPKCS5PrvKeyHex(A)
      } else {
        if (C.length > 2 && A.substr(C[1], 2) === "04") {
          D = new KJUR.crypto.ECDSA();
          D.readPKCS5PrvKeyHex(A)
        } else {
          throw "unsupported PKCS#1/5 hexadecimal key"
        }
      }
    }

    return D
  }
  if (j === "pkcs8prv") {
    var D = KEYUTIL.getKeyFromPlainPrivatePKCS8Hex(i);
    return D
  }
  if (j === "pkcs8pub") {
    return KEYUTIL.getKeyFromPublicPKCS8Hex(i)
  }
  if (j === "x509pub") {
    return X509.getPublicKeyFromCertHex(i)
  }
  if (i.indexOf("-END CERTIFICATE-", 0) != -1 || i.indexOf("-END X509 CERTIFICATE-", 0) != -1 || i.indexOf("-END TRUSTED CERTIFICATE-", 0) != -1) {
    return X509.getPublicKeyFromCertPEM(i)
  }
  if (i.indexOf("-END PUBLIC KEY-") != -1) {
    return KEYUTIL.getKeyFromPublicPKCS8PEM(i)
  }
  if (i.indexOf("-END RSA PRIVATE KEY-") != -1 && i.indexOf("4,ENCRYPTED") == -1) {
    var k = ASN1HEX.pemToHex(i, "RSA PRIVATE KEY");
    return KEYUTIL.getKey(k, null, "pkcs5prv")
  }
  if (i.indexOf("-END DSA PRIVATE KEY-") != -1 && i.indexOf("4,ENCRYPTED") == -1) {
    var z = ASN1HEX.pemToHex(i, "DSA PRIVATE KEY");
    var v = ASN1HEX.getVbyList(z, 0, [1], "02");
    var u = ASN1HEX.getVbyList(z, 0, [2], "02");
    var B = ASN1HEX.getVbyList(z, 0, [3], "02");
    var l = ASN1HEX.getVbyList(z, 0, [4], "02");
    var m = ASN1HEX.getVbyList(z, 0, [5], "02");
    var D = new KJUR.crypto.DSA();
    D.setPrivate(new BigInteger(v, 16), new BigInteger(u, 16), new BigInteger(B, 16), new BigInteger(l, 16), new BigInteger(m, 16));
    return D
  }
  if (i.indexOf("-END PRIVATE KEY-") != -1) {
    return KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(i)
  }
  if (i.indexOf("-END RSA PRIVATE KEY-") != -1 && i.indexOf("4,ENCRYPTED") != -1) {
    return KEYUTIL.getRSAKeyFromEncryptedPKCS5PEM(i, f)
  }
  if (i.indexOf("-END EC PRIVATE KEY-") != -1 && i.indexOf("4,ENCRYPTED") != -1) {
    var z = KEYUTIL.getDecryptedKeyHex(i, f);
    var D = ASN1HEX.getVbyList(z, 0, [1], "04");
    var d = ASN1HEX.getVbyList(z, 0, [2, 0], "06");
    var s = ASN1HEX.getVbyList(z, 0, [3, 0], "03").substr(2);
    var c = "";
    if (KJUR.crypto.OID.oidhex2name[d] !== undefined) {
      c = KJUR.crypto.OID.oidhex2name[d]
    } else {
      throw "undefined OID(hex) in KJUR.crypto.OID: " + d
    }
    var e = new KJUR.crypto.ECDSA({
      curve: c
    });
    e.setPublicKeyHex(s);
    e.setPrivateKeyHex(D);
    e.isPublic = false;
    return e
  }
  if (i.indexOf("-END DSA PRIVATE KEY-") != -1 && i.indexOf("4,ENCRYPTED") != -1) {
    var z = KEYUTIL.getDecryptedKeyHex(i, f);
    var v = ASN1HEX.getVbyList(z, 0, [1], "02");
    var u = ASN1HEX.getVbyList(z, 0, [2], "02");
    var B = ASN1HEX.getVbyList(z, 0, [3], "02");
    var l = ASN1HEX.getVbyList(z, 0, [4], "02");
    var m = ASN1HEX.getVbyList(z, 0, [5], "02");
    var D = new KJUR.crypto.DSA();
    D.setPrivate(new BigInteger(v, 16), new BigInteger(u, 16), new BigInteger(B, 16), new BigInteger(l, 16), new BigInteger(m, 16));
    return D
  }
  if (i.indexOf("-END ENCRYPTED PRIVATE KEY-") != -1) {
    return KEYUTIL.getKeyFromEncryptedPKCS8PEM(i, f)
  }
  throw "not supported argument"
};
KEYUTIL.generateKeypair = function (a, c) {
  if (a == "RSA") {
    var b = c;
    var h = new RSAKey();
    h.generate(b, "10001");
    h.isPrivate = true;
    h.isPublic = true;
    var f = new RSAKey();
    var e = h.n.toString(16);
    var i = h.e.toString(16);
    f.setPublic(e, i);
    f.isPrivate = false;
    f.isPublic = true;
    var k = {};
    k.prvKeyObj = h;
    k.pubKeyObj = f;
    return k
  } else {
    if (a == "EC") {
      var d = c;
      var g = new KJUR.crypto.ECDSA({
        curve: d
      });
      var j = g.generateKeyPairHex();
      var h = new KJUR.crypto.ECDSA({
        curve: d
      });
      h.setPublicKeyHex(j.ecpubhex);
      h.setPrivateKeyHex(j.ecprvhex);
      h.isPrivate = true;
      h.isPublic = false;
      var f = new KJUR.crypto.ECDSA({
        curve: d
      });
      f.setPublicKeyHex(j.ecpubhex);
      f.isPrivate = false;
      f.isPublic = true;
      var k = {};
      k.prvKeyObj = h;
      k.pubKeyObj = f;
      return k
    } else {
      throw "unknown algorithm: " + a
    }
  }
};
KEYUTIL.getPEM = function (a, r, o, g, j) {
  var v = KJUR.asn1;
  var u = KJUR.crypto;
  function p(s) {
    var w = KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 0
      },
      {
        "int": {
          bigint: s.n
        }
      },
      {
        "int": s.e
      },
      {
        "int": {
          bigint: s.d
        }
      },
      {
        "int": {
          bigint: s.p
        }
      },
      {
        "int": {
          bigint: s.q
        }
      },
      {
        "int": {
          bigint: s.dmp1
        }
      },
      {
        "int": {
          bigint: s.dmq1
        }
      },
      {
        "int": {
          bigint: s.coeff
        }
      }]
    });
    return w
  }
  function q(w) {
    var s = KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 1
      },
      {
        octstr: {
          hex: w.prvKeyHex
        }
      },
      {
        tag: ["a0", true, {
          oid: {
            name: w.curveName
          }
        }]
      },
      {
        tag: ["a1", true, {
          bitstr: {
            hex: "00" + w.pubKeyHex
          }
        }]
      }]
    });
    return s
  }
  function n(s) {
    var w = KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 0
      },
      {
        "int": {
          bigint: s.p
        }
      },
      {
        "int": {
          bigint: s.q
        }
      },
      {
        "int": {
          bigint: s.g
        }
      },
      {
        "int": {
          bigint: s.y
        }
      },
      {
        "int": {
          bigint: s.x
        }
      }]
    });
    return w
  }
  if (((typeof RSAKey != "undefined" && a instanceof RSAKey) || (typeof u.DSA != "undefined" && a instanceof u.DSA) || (typeof u.ECDSA != "undefined" && a instanceof u.ECDSA)) && a.isPublic == true && (r === undefined || r == "PKCS8PUB")) {
    var t = new KJUR.asn1.x509.SubjectPublicKeyInfo(a);
    var m = t.getEncodedHex();
    return v.ASN1Util.getPEMStringFromHex(m, "PUBLIC KEY")
  }
  if (r == "PKCS1PRV" && typeof RSAKey != "undefined" && a instanceof RSAKey && (o === undefined || o == null) && a.isPrivate == true) {
    var t = p(a);
    var m = t.getEncodedHex();
    return v.ASN1Util.getPEMStringFromHex(m, "RSA PRIVATE KEY")
  }
  if (r == "PKCS1PRV" && typeof RSAKey != "undefined" && a instanceof KJUR.crypto.ECDSA && (o === undefined || o == null) && a.isPrivate == true) {
    var f = new KJUR.asn1.DERObjectIdentifier({
      name: a.curveName
    });
    var l = f.getEncodedHex();
    var e = q(a);
    var k = e.getEncodedHex();
    var i = "";
    i += v.ASN1Util.getPEMStringFromHex(l, "EC PARAMETERS");
    i += v.ASN1Util.getPEMStringFromHex(k, "EC PRIVATE KEY");
    return i
  }
  if (r == "PKCS1PRV" && typeof KJUR.crypto.DSA != "undefined" && a instanceof KJUR.crypto.DSA && (o === undefined || o == null) && a.isPrivate == true) {
    var t = n(a);
    var m = t.getEncodedHex();
    return v.ASN1Util.getPEMStringFromHex(m, "DSA PRIVATE KEY")
  }
  if (r == "PKCS5PRV" && typeof RSAKey != "undefined" && a instanceof RSAKey && (o !== undefined && o != null) && a.isPrivate == true) {
    var t = p(a);
    var m = t.getEncodedHex();
    if (g === undefined) {
      g = "DES-EDE3-CBC"
    }
    return this.getEncryptedPKCS5PEMFromPrvKeyHex("RSA", m, o, g)
  }
  if (r == "PKCS5PRV" && typeof KJUR.crypto.ECDSA != "undefined" && a instanceof KJUR.crypto.ECDSA && (o !== undefined && o != null) && a.isPrivate == true) {
    var t = q(a);
    var m = t.getEncodedHex();
    if (g === undefined) {
      g = "DES-EDE3-CBC"
    }
    return this.getEncryptedPKCS5PEMFromPrvKeyHex("EC", m, o, g)
  }
  if (r == "PKCS5PRV" && typeof KJUR.crypto.DSA != "undefined" && a instanceof KJUR.crypto.DSA && (o !== undefined && o != null) && a.isPrivate == true) {
    var t = n(a);
    var m = t.getEncodedHex();
    if (g === undefined) {
      g = "DES-EDE3-CBC"
    }
    return this.getEncryptedPKCS5PEMFromPrvKeyHex("DSA", m, o, g)
  }
  var h = function (w, s) {
    var y = b(w, s);
    var x = new KJUR.asn1.ASN1Util.newObject({
      seq: [{
        seq: [{
          oid: {
            name: "pkcs5PBES2"
          }
        },
        {
          seq: [{
            seq: [{
              oid: {
                name: "pkcs5PBKDF2"
              }
            },
            {
              seq: [{
                octstr: {
                  hex: y.pbkdf2Salt
                }
              },
              {
                "int": y.pbkdf2Iter
              }]
            }]
          },
          {
            seq: [{
              oid: {
                name: "des-EDE3-CBC"
              }
            },
            {
              octstr: {
                hex: y.encryptionSchemeIV
              }
            }]
          }]
        }]
      },
      {
        octstr: {
          hex: y.ciphertext
        }
      }]
    });
    return x.getEncodedHex()
  };
  var b = function (D, E) {
    var x = 100;
    var C = CryptoJS.lib.WordArray.random(8);
    var B = "DES-EDE3-CBC";
    var s = CryptoJS.lib.WordArray.random(8);
    var y = CryptoJS.PBKDF2(E, C, {
      keySize: 192 / 32,
      iterations: x
    });
    var z = CryptoJS.enc.Hex.parse(D);
    var A = CryptoJS.TripleDES.encrypt(z, y, {
      iv: s
    }) + "";
    var w = {};
    w.ciphertext = A;
    w.pbkdf2Salt = CryptoJS.enc.Hex.stringify(C);
    w.pbkdf2Iter = x;
    w.encryptionSchemeAlg = B;
    w.encryptionSchemeIV = CryptoJS.enc.Hex.stringify(s);
    return w
  };
  if (r == "PKCS8PRV" && typeof RSAKey != "undefined" && a instanceof RSAKey && a.isPrivate == true) {
    var d = p(a);
    var c = d.getEncodedHex();
    var t = KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 0
      },
      {
        seq: [{
          oid: {
            name: "rsaEncryption"
          }
        },
        {
          "null": true
        }]
      },
      {
        octstr: {
          hex: c
        }
      }]
    });
    var m = t.getEncodedHex();
    if (o === undefined || o == null) {
      return v.ASN1Util.getPEMStringFromHex(m, "PRIVATE KEY")
    } else {
      var k = h(m, o);
      return v.ASN1Util.getPEMStringFromHex(k, "ENCRYPTED PRIVATE KEY")
    }
  }
  if (r == "PKCS8PRV" && typeof KJUR.crypto.ECDSA != "undefined" && a instanceof KJUR.crypto.ECDSA && a.isPrivate == true) {
    var d = new KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 1
      },
      {
        octstr: {
          hex: a.prvKeyHex
        }
      },
      {
        tag: ["a1", true, {
          bitstr: {
            hex: "00" + a.pubKeyHex
          }
        }]
      }]
    });
    var c = d.getEncodedHex();
    var t = KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 0
      },
      {
        seq: [{
          oid: {
            name: "ecPublicKey"
          }
        },
        {
          oid: {
            name: a.curveName
          }
        }]
      },
      {
        octstr: {
          hex: c
        }
      }]
    });
    var m = t.getEncodedHex();
    if (o === undefined || o == null) {
      return v.ASN1Util.getPEMStringFromHex(m, "PRIVATE KEY")
    } else {
      var k = h(m, o);
      return v.ASN1Util.getPEMStringFromHex(k, "ENCRYPTED PRIVATE KEY")
    }
  }
  if (r == "PKCS8PRV" && typeof KJUR.crypto.DSA != "undefined" && a instanceof KJUR.crypto.DSA && a.isPrivate == true) {
    var d = new KJUR.asn1.DERInteger({
      bigint: a.x
    });
    var c = d.getEncodedHex();
    var t = KJUR.asn1.ASN1Util.newObject({
      seq: [{
        "int": 0
      },
      {
        seq: [{
          oid: {
            name: "dsa"
          }
        },
        {
          seq: [{
            "int": {
              bigint: a.p
            }
          },
          {
            "int": {
              bigint: a.q
            }
          },
          {
            "int": {
              bigint: a.g
            }
          }]
        }]
      },
      {
        octstr: {
          hex: c
        }
      }]
    });
    var m = t.getEncodedHex();
    if (o === undefined || o == null) {
      return v.ASN1Util.getPEMStringFromHex(m, "PRIVATE KEY")
    } else {
      var k = h(m, o);
      return v.ASN1Util.getPEMStringFromHex(k, "ENCRYPTED PRIVATE KEY")
    }
  }
  throw "unsupported object nor format"
};
KEYUTIL.getKeyFromCSRPEM = function (b) {
  var a = ASN1HEX.pemToHex(b, "CERTIFICATE REQUEST");
  var c = KEYUTIL.getKeyFromCSRHex(a);
  return c
};
KEYUTIL.getKeyFromCSRHex = function (a) {
  var c = KEYUTIL.parseCSRHex(a);
  var b = KEYUTIL.getKey(c.p8pubkeyhex, null, "pkcs8pub");
  return b
};
KEYUTIL.parseCSRHex = function (c) {
  var b = {};
  var e = c;
  if (e.substr(0, 2) != "30") {
    throw "malformed CSR(code:001)"
  }
  var d = ASN1HEX.getPosArrayOfChildren_AtObj(e, 0);
  if (d.length < 1) {
    throw "malformed CSR(code:002)"
  }
  if (e.substr(d[0], 2) != "30") {
    throw "malformed CSR(code:003)"
  }
  var a = ASN1HEX.getPosArrayOfChildren_AtObj(e, d[0]);
  if (a.length < 3) {
    throw "malformed CSR(code:004)"
  }
  b.p8pubkeyhex = ASN1HEX.getHexOfTLV_AtObj(e, a[2]);
  return b
};
KEYUTIL.getJWKFromKey = function (d) {
  var b = {};
  if (d instanceof RSAKey && d.isPrivate) {
    b.kty = "RSA";
    b.n = hextob64u(d.n.toString(16));
    b.e = hextob64u(d.e.toString(16));
    b.d = hextob64u(d.d.toString(16));
    b.p = hextob64u(d.p.toString(16));
    b.q = hextob64u(d.q.toString(16));
    b.dp = hextob64u(d.dmp1.toString(16));
    b.dq = hextob64u(d.dmq1.toString(16));
    b.qi = hextob64u(d.coeff.toString(16));
    return b
  } else {
    if (d instanceof RSAKey && d.isPublic) {
      b.kty = "RSA";
      b.n = hextob64u(d.n.toString(16));
      b.e = hextob64u(d.e.toString(16));
      return b
    } else {
      if (d instanceof KJUR.crypto.ECDSA && d.isPrivate) {
        var a = d.getShortNISTPCurveName();
        if (a !== "P-256" && a !== "P-384") {
          throw "unsupported curve name for JWT: " + a
        }
        var c = d.getPublicKeyXYHex();
        b.kty = "EC";
        b.crv = a;
        b.x = hextob64u(c.x);
        b.y = hextob64u(c.y);
        b.d = hextob64u(d.prvKeyHex);
        return b
      } else {
        if (d instanceof KJUR.crypto.ECDSA && d.isPublic) {
          var a = d.getShortNISTPCurveName();
          if (a !== "P-256" && a !== "P-384") {
            throw "unsupported curve name for JWT: " + a
          }
          var c = d.getPublicKeyXYHex();
          b.kty = "EC";
          b.crv = a;
          b.x = hextob64u(c.x);
          b.y = hextob64u(c.y);
          return b
        }
      }
    }
  }
  throw "not supported key object"
};
/*! rsapem-1.2.0.js (c) 2012-2017 Kenji Urushima | kjur.github.com/jsrsasign/license
 */
RSAKey.pemToBase64 = function (b) {
  var a = b;
  a = a.replace("-----BEGIN RSA PRIVATE KEY-----", "");
  a = a.replace("-----END RSA PRIVATE KEY-----", "");
  a = a.replace(/[ \n]+/g, "");
  return a
};
RSAKey.getPosArrayOfChildrenFromHex = function (g) {
  var j = new Array();
  var i = ASN1HEX.getStartPosOfV_AtObj(g, 0);
  var b = ASN1HEX.getPosOfNextSibling_AtObj(g, i);
  var e = ASN1HEX.getPosOfNextSibling_AtObj(g, b);
  var f = ASN1HEX.getPosOfNextSibling_AtObj(g, e);
  var l = ASN1HEX.getPosOfNextSibling_AtObj(g, f);
  var k = ASN1HEX.getPosOfNextSibling_AtObj(g, l);
  var d = ASN1HEX.getPosOfNextSibling_AtObj(g, k);
  var c = ASN1HEX.getPosOfNextSibling_AtObj(g, d);
  var h = ASN1HEX.getPosOfNextSibling_AtObj(g, c);
  j.push(i, b, e, f, l, k, d, c, h);
  return j
};
RSAKey.getHexValueArrayOfChildrenFromHex = function (f) {
  var l = RSAKey.getPosArrayOfChildrenFromHex(f);
  var e = ASN1HEX.getHexOfV_AtObj(f, l[0]);
  var j = ASN1HEX.getHexOfV_AtObj(f, l[1]);
  var b = ASN1HEX.getHexOfV_AtObj(f, l[2]);
  var c = ASN1HEX.getHexOfV_AtObj(f, l[3]);
  var h = ASN1HEX.getHexOfV_AtObj(f, l[4]);
  var g = ASN1HEX.getHexOfV_AtObj(f, l[5]);
  var m = ASN1HEX.getHexOfV_AtObj(f, l[6]);
  var k = ASN1HEX.getHexOfV_AtObj(f, l[7]);
  var d = ASN1HEX.getHexOfV_AtObj(f, l[8]);
  var i = new Array();
  i.push(e, j, b, c, h, g, m, k, d);
  return i
};
RSAKey.prototype.readPrivateKeyFromPEMString = function (e) {
  var c = RSAKey.pemToBase64(e);
  var d = b64tohex(c);
  var b = RSAKey.getHexValueArrayOfChildrenFromHex(d);
  this.setPrivateEx(b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8])
};
RSAKey.prototype.readPrivateKeyFromASN1HexString = function (a) {
  this.readPKCS5PrvKeyHex(a)
};
RSAKey.prototype.readPKCS5PrvKeyHex = function (c) {
  var b = RSAKey.getHexValueArrayOfChildrenFromHex(c);
  this.setPrivateEx(b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8])
};
RSAKey.prototype.readPKCS8PrvKeyHex = function (e) {
  var c, j, l, b, a, f, d, k;
  var m = ASN1HEX;
  var g = m.getVbyList;
  if (m.isASN1HEX(e) === false) {
    throw "not ASN.1 hex string"
  }
  try {
    c = g(e, 0, [2, 0, 1], "02");
    j = g(e, 0, [2, 0, 2], "02");
    l = g(e, 0, [2, 0, 3], "02");
    b = g(e, 0, [2, 0, 4], "02");
    a = g(e, 0, [2, 0, 5], "02");
    f = g(e, 0, [2, 0, 6], "02");
    d = g(e, 0, [2, 0, 7], "02");
    k = g(e, 0, [2, 0, 8], "02")
  } catch (i) {
    throw "malformed PKCS#8 plain RSA private key"
  }
  this.setPrivateEx(c, j, l, b, a, f, d, k)
};
RSAKey.prototype.readPKCS5PubKeyHex = function (b) {
  if (ASN1HEX.isASN1HEX(b) === false) {
    throw "keyHex is not ASN.1 hex string"
  }
  var a = ASN1HEX.getPosArrayOfChildren_AtObj(b, 0);
  if (a.length !== 2 || b.substr(a[0], 2) !== "02" || b.substr(a[1], 2) !== "02") {
    throw "wrong hex for PKCS#5 public key"
  }
  var d = ASN1HEX.getHexOfV_AtObj(b, a[0]);
  var c = ASN1HEX.getHexOfV_AtObj(b, a[1]);
  this.setPublic(d, c)
};
RSAKey.prototype.readPKCS8PubKeyHex = function (b) {
  if (ASN1HEX.isASN1HEX(b) === false) {
    throw "not ASN.1 hex string"
  }
  if (ASN1HEX.getDecendantHexTLVByNthList(b, 0, [0, 0]) !== "06092a864886f70d010101") {
    throw "not PKCS8 RSA public key"
  }
  var a = ASN1HEX.getDecendantHexTLVByNthList(b, 0, [1, 0]);
  this.readPKCS5PubKeyHex(a)
};
RSAKey.prototype.readCertPubKeyHex = function (b, c) {
  if (c !== 5) {
    c = 6
  }
  if (ASN1HEX.isASN1HEX(b) === false) {
    throw "not ASN.1 hex string"
  }
  var a = ASN1HEX.getDecendantHexTLVByNthList(b, 0, [0, c]);
  this.readPKCS8PubKeyHex(a)
};
/*! rsasign-1.2.7.js (c) 2012 Kenji Urushima | kjur.github.com/jsrsasign/license
 */
var _RE_HEXDECONLY = new RegExp("");
_RE_HEXDECONLY.compile("[^0-9a-f]", "gi");
function _rsasign_getHexPaddedDigestInfoForString(d, e, a) {
  var b = function (f) {
    return KJUR.crypto.Util.hashString(f, a)
  };
  var c = b(d);
  return KJUR.crypto.Util.getPaddedDigestInfoHex(c, a, e)
}
function _zeroPaddingOfSignature(e, d) {
  var c = "";
  var a = d / 4 - e.length;
  for (var b = 0; b < a; b++) {
    c = c + "0"
  }
  return c + e
}
function _rsasign_signString(d, a) {

  var b = function (e) {
    return KJUR.crypto.Util.hashString(e, a)
  };
  var c = b(d);
  return this.signWithMessageHash(c, a)
}
function _rsasign_signWithMessageHash(e, c) {
  var f = KJUR.crypto.Util.getPaddedDigestInfoHex(e, c, this.n.bitLength());
  var b = parseBigInt(f, 16);
  var d = this.doPrivate(b);
  var a = d.toString(16);
  return _zeroPaddingOfSignature(a, this.n.bitLength())
}
function _rsasign_signStringWithSHA1(a) {
  return _rsasign_signString.call(this, a, "sha1")
}
function _rsasign_signStringWithSHA256(a) {
  return _rsasign_signString.call(this, a, "sha256")
}
function pss_mgf1_str(c, a, e) {
  var b = "",
    d = 0;
  while (b.length < a) {
    b += hextorstr(e(rstrtohex(c + String.fromCharCode.apply(String, [(d & 4278190080) >> 24, (d & 16711680) >> 16, (d & 65280) >> 8, d & 255]))));
    d += 1
  }
  return b
}
function _rsasign_signStringPSS(e, a, d) {
  var c = function (f) {
    return KJUR.crypto.Util.hashHex(f, a)
  };
  var b = c(rstrtohex(e));
  if (d === undefined) {
    d = -1
  }
  return this.signWithMessageHashPSS(b, a, d)
}
function _rsasign_signWithMessageHashPSS(l, a, k) {
  var b = hextorstr(l);
  var g = b.length;
  var m = this.n.bitLength() - 1;
  var c = Math.ceil(m / 8);
  var d;
  var o = function (i) {
    return KJUR.crypto.Util.hashHex(i, a)
  };
  if (k === -1 || k === undefined) {
    k = g
  } else {
    if (k === -2) {
      k = c - g - 2
    } else {
      if (k < -2) {
        throw "invalid salt length"
      }
    }
  }
  if (c < (g + k + 2)) {
    throw "data too long"
  }
  var f = "";
  if (k > 0) {
    f = new Array(k);
    new SecureRandom().nextBytes(f);
    f = String.fromCharCode.apply(String, f)
  }
  var n = hextorstr(o(rstrtohex("\x00\x00\x00\x00\x00\x00\x00\x00" + b + f)));
  var j = [];
  for (d = 0; d < c - k - g - 2; d += 1) {
    j[d] = 0
  }
  var e = String.fromCharCode.apply(String, j) + "\x01" + f;
  var h = pss_mgf1_str(n, e.length, o);
  var q = [];
  for (d = 0; d < e.length; d += 1) {
    q[d] = e.charCodeAt(d) ^ h.charCodeAt(d)
  }
  var p = (65280 >> (8 * c - m)) & 255;
  q[0] &= ~p;
  for (d = 0; d < g; d++) {
    q.push(n.charCodeAt(d))
  }
  q.push(188);
  return _zeroPaddingOfSignature(this.doPrivate(new BigInteger(q)).toString(16), this.n.bitLength())
}
function _rsasign_getDecryptSignatureBI(a, d, c) {
  var b = new RSAKey();
  b.setPublic(d, c);
  var e = b.doPublic(a);
  return e
}
function _rsasign_getHexDigestInfoFromSig(a, c, b) {
  var e = _rsasign_getDecryptSignatureBI(a, c, b);
  var d = e.toString(16).replace(/^1f+00/, "");
  return d
}
function _rsasign_getAlgNameAndHashFromHexDisgestInfo(f) {
  for (var e in KJUR.crypto.Util.DIGESTINFOHEAD) {
    var d = KJUR.crypto.Util.DIGESTINFOHEAD[e];
    var b = d.length;
    if (f.substring(0, b) == d) {
      var c = [e, f.substring(b)];
      return c
    }
  }
  return []
}
function _rsasign_verifySignatureWithArgs(f, b, g, j) {
  var e = _rsasign_getHexDigestInfoFromSig(b, g, j);
  var h = _rsasign_getAlgNameAndHashFromHexDisgestInfo(e);
  if (h.length == 0) {
    return false
  }
  var d = h[0];
  var i = h[1];
  var a = function (k) {
    return KJUR.crypto.Util.hashString(k, d)
  };
  var c = a(f);
  return (i == c)
}
function _rsasign_verifyHexSignatureForMessage(c, b) {
  var d = parseBigInt(c, 16);
  var a = _rsasign_verifySignatureWithArgs(b, d, this.n.toString(16), this.e.toString(16));
  return a
}
function _rsasign_verifyString(f, j) {
  j = j.replace(_RE_HEXDECONLY, "");
  j = j.replace(/[ \n]+/g, "");
  var b = parseBigInt(j, 16);
  if (b.bitLength() > this.n.bitLength()) {
    return 0
  }
  var i = this.doPublic(b);
  var e = i.toString(16).replace(/^1f+00/, "");
  var g = _rsasign_getAlgNameAndHashFromHexDisgestInfo(e);
  if (g.length == 0) {
    return false
  }
  var d = g[0];
  var h = g[1];
  var a = function (k) {
    return KJUR.crypto.Util.hashString(k, d)
  };
  var c = a(f);
  return (h == c)
}
function _rsasign_verifyWithMessageHash(e, a) {
  a = a.replace(_RE_HEXDECONLY, "");
  a = a.replace(/[ \n]+/g, "");
  var b = parseBigInt(a, 16);
  if (b.bitLength() > this.n.bitLength()) {
    return 0
  }
  var h = this.doPublic(b);
  var g = h.toString(16).replace(/^1f+00/, "");
  var c = _rsasign_getAlgNameAndHashFromHexDisgestInfo(g);
  if (c.length == 0) {
    return false
  }
  var d = c[0];
  var f = c[1];
  return (f == e)
}
function _rsasign_verifyStringPSS(c, b, a, f) {
  var e = function (g) {
    return KJUR.crypto.Util.hashHex(g, a)
  };
  var d = e(rstrtohex(c));
  if (f === undefined) {
    f = -1
  }
  return this.verifyWithMessageHashPSS(d, b, a, f)
}
function _rsasign_verifyWithMessageHashPSS(f, s, l, c) {
  var k = new BigInteger(s, 16);
  if (k.bitLength() > this.n.bitLength()) {
    return false
  }
  var r = function (i) {
    return KJUR.crypto.Util.hashHex(i, l)
  };
  var j = hextorstr(f);
  var h = j.length;
  var g = this.n.bitLength() - 1;
  var m = Math.ceil(g / 8);
  var q;
  if (c === -1 || c === undefined) {
    c = h
  } else {
    if (c === -2) {
      c = m - h - 2
    } else {
      if (c < -2) {
        throw "invalid salt length"
      }
    }
  }
  if (m < (h + c + 2)) {
    throw "data too long"
  }
  var a = this.doPublic(k).toByteArray();
  for (q = 0; q < a.length; q += 1) {
    a[q] &= 255
  }
  while (a.length < m) {
    a.unshift(0)
  }
  if (a[m - 1] !== 188) {
    throw "encoded message does not end in 0xbc"
  }
  a = String.fromCharCode.apply(String, a);
  var d = a.substr(0, m - h - 1);
  var e = a.substr(d.length, h);
  var p = (65280 >> (8 * m - g)) & 255;
  if ((d.charCodeAt(0) & p) !== 0) {
    throw "bits beyond keysize not zero"
  }
  var n = pss_mgf1_str(e, d.length, r);
  var o = [];
  for (q = 0; q < d.length; q += 1) {
    o[q] = d.charCodeAt(q) ^ n.charCodeAt(q)
  }
  o[0] &= ~p;
  var b = m - h - c - 2;
  for (q = 0; q < b; q += 1) {
    if (o[q] !== 0) {
      throw "leftmost octets not zero"
    }
  }
  if (o[b] !== 1) {
    throw "0x01 marker not found"
  }
  return e === hextorstr(r(rstrtohex("\x00\x00\x00\x00\x00\x00\x00\x00" + j + String.fromCharCode.apply(String, o.slice(- c)))))
}
RSAKey.prototype.signWithMessageHash = _rsasign_signWithMessageHash;
RSAKey.prototype.signString = _rsasign_signString;
RSAKey.prototype.signStringWithSHA1 = _rsasign_signStringWithSHA1;
RSAKey.prototype.signStringWithSHA256 = _rsasign_signStringWithSHA256;
RSAKey.prototype.sign = _rsasign_signString;
RSAKey.prototype.signWithSHA1 = _rsasign_signStringWithSHA1;
RSAKey.prototype.signWithSHA256 = _rsasign_signStringWithSHA256;
RSAKey.prototype.signWithMessageHashPSS = _rsasign_signWithMessageHashPSS;
RSAKey.prototype.signStringPSS = _rsasign_signStringPSS;
RSAKey.prototype.signPSS = _rsasign_signStringPSS;
RSAKey.SALT_LEN_HLEN = -1;
RSAKey.SALT_LEN_MAX = -2;
RSAKey.prototype.verifyWithMessageHash = _rsasign_verifyWithMessageHash;
RSAKey.prototype.verifyString = _rsasign_verifyString;
RSAKey.prototype.verifyHexSignatureForMessage = _rsasign_verifyHexSignatureForMessage;
RSAKey.prototype.verify = _rsasign_verifyString;
RSAKey.prototype.verifyHexSignatureForByteArrayMessage = _rsasign_verifyHexSignatureForMessage;
RSAKey.prototype.verifyWithMessageHashPSS = _rsasign_verifyWithMessageHashPSS;
RSAKey.prototype.verifyStringPSS = _rsasign_verifyStringPSS;
RSAKey.prototype.verifyPSS = _rsasign_verifyStringPSS;
RSAKey.SALT_LEN_RECOVER = -2;
/*! x509-1.1.12.js (c) 2012-2017 Kenji Urushima | kjur.github.com/jsrsasign/license
 */
function X509() {
  this.subjectPublicKeyRSA = null;
  this.subjectPublicKeyRSA_hN = null;
  this.subjectPublicKeyRSA_hE = null;
  this.hex = null;
  this.getSerialNumberHex = function () {
    return ASN1HEX.getDecendantHexVByNthList(this.hex, 0, [0, 1])
  };
  this.getSignatureAlgorithmField = function () {
    var b = ASN1HEX.getDecendantHexVByNthList(this.hex, 0, [0, 2, 0]);
    var a = KJUR.asn1.ASN1Util.oidHexToInt(b);
    var c = KJUR.asn1.x509.OID.oid2name(a);
    return c
  };
  this.getIssuerHex = function () {
    return ASN1HEX.getDecendantHexTLVByNthList(this.hex, 0, [0, 3])
  };
  this.getIssuerString = function () {
    return X509.hex2dn(ASN1HEX.getDecendantHexTLVByNthList(this.hex, 0, [0, 3]))
  };
  this.getSubjectHex = function () {
    return ASN1HEX.getDecendantHexTLVByNthList(this.hex, 0, [0, 5])
  };
  this.getSubjectString = function () {
    return X509.hex2dn(ASN1HEX.getDecendantHexTLVByNthList(this.hex, 0, [0, 5]))
  };
  this.getNotBefore = function () {
    var a = ASN1HEX.getDecendantHexVByNthList(this.hex, 0, [0, 4, 0]);
    a = a.replace(/(..)/g, "%$1");
    a = decodeURIComponent(a);
    return a
  };
  this.getNotAfter = function () {
    var a = ASN1HEX.getDecendantHexVByNthList(this.hex, 0, [0, 4, 1]);
    a = a.replace(/(..)/g, "%$1");
    a = decodeURIComponent(a);
    return a
  };
  this.readCertPEM = function (c) {
    var e = ASN1HEX.pemToHex(c);
    var b = X509.getPublicKeyHexArrayFromCertHex(e);
    var d = new RSAKey();
    d.setPublic(b[0], b[1]);
    this.subjectPublicKeyRSA = d;
    this.subjectPublicKeyRSA_hN = b[0];
    this.subjectPublicKeyRSA_hE = b[1];
    this.hex = e
  };
  this.readCertPEMWithoutRSAInit = function (c) {
    var d = ASN1HEX.pemToHex(c);
    var b = X509.getPublicKeyHexArrayFromCertHex(d);
    if (typeof this.subjectPublicKeyRSA.setPublic === "function") {
      this.subjectPublicKeyRSA.setPublic(b[0], b[1])
    }
    this.subjectPublicKeyRSA_hN = b[0];
    this.subjectPublicKeyRSA_hE = b[1];
    this.hex = d
  };
  this.getInfo = function () {
    var p = "Basic Fields\n";
    p += "  serial number: " + this.getSerialNumberHex() + "\n";
    p += "  signature algorithm: " + this.getSignatureAlgorithmField() + "\n";
    p += "  issuer: " + this.getIssuerString() + "\n";
    p += "  notBefore: " + this.getNotBefore() + "\n";
    p += "  notAfter: " + this.getNotAfter() + "\n";
    p += "  subject: " + this.getSubjectString() + "\n";
    p += "  subject public key info: \n";
    var j = X509.getSubjectPublicKeyInfoPosFromCertHex(this.hex);
    var d = ASN1HEX.getHexOfTLV_AtObj(this.hex, j);
    var n = KEYUTIL.getKey(d, null, "pkcs8pub");
    if (n instanceof RSAKey) {
      p += "    key algorithm: RSA\n";
      p += "    n=" + n.n.toString(16).substr(0, 16) + "...\n";
      p += "    e=" + n.e.toString(16) + "\n"
    }
    p += "X509v3 Extensions:\n";
    var m = X509.getV3ExtInfoListOfCertHex(this.hex);
    for (var e = 0; e < m.length; e++) {
      var b = m[e];
      var o = KJUR.asn1.x509.OID.oid2name(b.oid);
      if (o === "") {
        o = b.oid
      }
      var k = "";
      if (b.critical === true) {
        k = "CRITICAL"
      }
      p += "  " + o + " " + k + ":\n";
      if (o === "basicConstraints") {
        var g = X509.getExtBasicConstraints(this.hex);
        if (g.cA === undefined) {
          p += "    {}\n"
        } else {
          p += "    cA=true";
          if (g.pathLen !== undefined) {
            p += ", pathLen=" + g.pathLen
          }
          p += "\n"
        }
      } else {
        if (o === "keyUsage") {
          p += "    " + X509.getExtKeyUsageString(this.hex) + "\n"
        } else {
          if (o === "subjectKeyIdentifier") {
            p += "    " + X509.getExtSubjectKeyIdentifier(this.hex) + "\n"
          } else {
            if (o === "authorityKeyIdentifier") {
              var a = X509.getExtAuthorityKeyIdentifier(this.hex);
              if (a.kid !== undefined) {
                p += "    kid=" + a.kid + "\n"
              }
            } else {
              if (o === "extKeyUsage") {
                var h = X509.getExtExtKeyUsageName(this.hex);
                p += "    " + h.join(", ") + "\n"
              } else {
                if (o === "subjectAltName") {
                  var f = X509.getExtSubjectAltName(this.hex);
                  p += "    " + f.join(", ") + "\n"
                } else {
                  if (o === "cRLDistributionPoints") {
                    var l = X509.getExtCRLDistributionPointsURI(this.hex);
                    p += "    " + l + "\n"
                  } else {
                    if (o === "authorityInfoAccess") {
                      var c = X509.getExtAIAInfo(this.hex);
                      if (c.ocsp !== undefined) {
                        p += "    ocsp: " + c.ocsp.join(",") + "\n"
                      }
                      if (c.caissuer !== undefined) {
                        p += "    caissuer: " + c.caissuer.join(",") + "\n"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    p += "signature algorithm: " + X509.getSignatureAlgorithmName(this.hex) + "\n";
    p += "signature: " + X509.getSignatureValueHex(this.hex).substr(0, 16) + "...\n";
    return p
  }
}
X509.pemToBase64 = function (a) {
  var b = a;
  b = b.replace("-----BEGIN CERTIFICATE-----", "");
  b = b.replace("-----END CERTIFICATE-----", "");
  b = b.replace(/[ \n]+/g, "");
  return b
};
X509.pemToHex = function (a) {
  return ASN1HEX.pemToHex(a)
};
X509.getSubjectPublicKeyPosFromCertHex = function (f) {
  var e = X509.getSubjectPublicKeyInfoPosFromCertHex(f);
  if (e == -1) {
    return - 1
  }
  var b = ASN1HEX.getPosArrayOfChildren_AtObj(f, e);
  if (b.length != 2) {
    return - 1
  }
  var d = b[1];
  if (f.substring(d, d + 2) != "03") {
    return - 1
  }
  var c = ASN1HEX.getStartPosOfV_AtObj(f, d);
  if (f.substring(c, c + 2) != "00") {
    return - 1
  }
  return c + 2
};
X509.getSubjectPublicKeyInfoPosFromCertHex = function (d) {
  var c = ASN1HEX.getStartPosOfV_AtObj(d, 0);
  var b = ASN1HEX.getPosArrayOfChildren_AtObj(d, c);
  if (b.length < 1) {
    return - 1
  }
  if (d.substring(b[0], b[0] + 10) == "a003020102") {
    if (b.length < 6) {
      return - 1
    }
    return b[6]
  } else {
    if (b.length < 5) {
      return - 1
    }
    return b[5]
  }
};
X509.getPublicKeyHexArrayFromCertHex = function (f) {
  var e = X509.getSubjectPublicKeyPosFromCertHex(f);
  var b = ASN1HEX.getPosArrayOfChildren_AtObj(f, e);
  if (b.length != 2) {
    return []
  }
  var d = ASN1HEX.getHexOfV_AtObj(f, b[0]);
  var c = ASN1HEX.getHexOfV_AtObj(f, b[1]);
  if (d != null && c != null) {
    return [d, c]
  } else {
    return []
  }
};
X509.getHexTbsCertificateFromCert = function (b) {
  var a = ASN1HEX.getStartPosOfV_AtObj(b, 0);
  return a
};
X509.getPublicKeyHexArrayFromCertPEM = function (c) {
  var d = ASN1HEX.pemToHex(c);
  var b = X509.getPublicKeyHexArrayFromCertHex(d);
  return b
};
X509.hex2dn = function (f, b) {
  if (b === undefined) {
    b = 0
  }
  if (f.substr(b, 2) !== "30") {
    throw "malformed DN"
  }
  var c = new Array();
  var d = ASN1HEX.getPosArrayOfChildren_AtObj(f, b);
  for (var e = 0; e < d.length; e++) {
    c.push(X509.hex2rdn(f, d[e]))
  }
  c = c.map(function (a) {
    return a.replace("/", "\\/")
  });
  return "/" + c.join("/")
};
X509.hex2rdn = function (f, b) {
  if (b === undefined) {
    b = 0
  }
  if (f.substr(b, 2) !== "31") {
    throw "malformed RDN"
  }
  var c = new Array();
  var d = ASN1HEX.getPosArrayOfChildren_AtObj(f, b);
  for (var e = 0; e < d.length; e++) {
    c.push(X509.hex2attrTypeValue(f, d[e]))
  }
  c = c.map(function (a) {
    return a.replace("+", "\\+")
  });
  return c.join("+")
};
X509.hex2attrTypeValue = function (g, b) {
  if (b === undefined) {
    b = 0
  }
  if (g.substr(b, 2) !== "30") {
    throw "malformed attribute type and value"
  }
  var c = ASN1HEX.getPosArrayOfChildren_AtObj(g, b);
  if (c.length !== 2 || g.substr(c[0], 2) !== "06") {
    "malformed attribute type and value"
  }
  var d = ASN1HEX.getHexOfV_AtObj(g, c[0]);
  var h = KJUR.asn1.ASN1Util.oidHexToInt(d);
  var f = KJUR.asn1.x509.OID.oid2atype(h);
  var a = ASN1HEX.getHexOfV_AtObj(g, c[1]);
  var e = hextorstr(a);
  return f + "=" + e
};
X509.getPublicKeyFromCertHex = function (c) {
  var a, e, b;
  var g = 6;
  var d = ASN1HEX;
  var f = d.getVbyList;
  b = d.getDecendantHexTLVByNthList(c, 0, [0, 0]);
  if (b !== "a003020102") {
    g = 5
  }
  e = f(c, 0, [0, g, 0, 0], "06");
  if (e === "2a864886f70d010101") {
    a = new RSAKey()
  } else {
    if (e === "2a8648ce380401") {
      a = new KJUR.crypto.DSA()
    } else {
      if (e === "2a8648ce3d0201") {
        a = new KJUR.crypto.ECDSA()
      } else {
        throw "unsupported public key in X.509 cert"
      }
    }
  }
  a.readCertPubKeyHex(c, g);
  return a
};
X509.getPublicKeyFromCertPEM = function (a) {
  var c = ASN1HEX;
  var b = c.pemToHex(a);
  return X509.getPublicKeyFromCertHex(b)
};
X509.getPublicKeyInfoPropOfCertPEM = function (e) {
  var i = {};
  i.algparam = null;
  var f = ASN1HEX.pemToHex(e);
  var d = ASN1HEX.getPosArrayOfChildren_AtObj(f, 0);
  if (d.length != 3) {
    throw "malformed X.509 certificate PEM (code:001)"
  }
  if (f.substr(d[0], 2) != "30") {
    throw "malformed X.509 certificate PEM (code:002)"
  }
  var c = ASN1HEX.getPosArrayOfChildren_AtObj(f, d[0]);
  var g = 6;
  if (f.substr(c[0], 2) !== "a0") {
    g = 5
  }
  if (c.length < g + 1) {
    throw "malformed X.509 certificate PEM (code:003)"
  }
  var a = ASN1HEX.getPosArrayOfChildren_AtObj(f, c[g]);
  if (a.length != 2) {
    throw "malformed X.509 certificate PEM (code:004)"
  }
  var h = ASN1HEX.getPosArrayOfChildren_AtObj(f, a[0]);
  if (h.length != 2) {
    throw "malformed X.509 certificate PEM (code:005)"
  }
  i.algoid = ASN1HEX.getHexOfV_AtObj(f, h[0]);
  if (f.substr(h[1], 2) == "06") {
    i.algparam = ASN1HEX.getHexOfV_AtObj(f, h[1])
  } else {
    if (f.substr(h[1], 2) == "30") {
      i.algparam = ASN1HEX.getHexOfTLV_AtObj(f, h[1])
    }
  }
  if (f.substr(a[1], 2) != "03") {
    throw "malformed X.509 certificate PEM (code:006)"
  }
  var b = ASN1HEX.getHexOfV_AtObj(f, a[1]);
  i.keyhex = b.substr(2);
  return i
};
X509.getPublicKeyInfoPosOfCertHEX = function (c) {
  var b = ASN1HEX.getPosArrayOfChildren_AtObj(c, 0);
  if (b.length != 3) {
    throw "malformed X.509 certificate PEM (code:001)"
  }
  if (c.substr(b[0], 2) != "30") {
    throw "malformed X.509 certificate PEM (code:002)"
  }
  var a = ASN1HEX.getPosArrayOfChildren_AtObj(c, b[0]);
  if (a.length < 7) {
    throw "malformed X.509 certificate PEM (code:003)"
  }
  return a[6]
};
X509.getV3ExtInfoListOfCertHex = function (g) {
  var b = ASN1HEX.getPosArrayOfChildren_AtObj(g, 0);
  if (b.length != 3) {
    throw "malformed X.509 certificate PEM (code:001)"
  }
  if (g.substr(b[0], 2) != "30") {
    throw "malformed X.509 certificate PEM (code:002)"
  }
  var a = ASN1HEX.getPosArrayOfChildren_AtObj(g, b[0]);
  if (a.length < 8) {
    throw "malformed X.509 certificate PEM (code:003)"
  }
  if (g.substr(a[7], 2) != "a3") {
    throw "malformed X.509 certificate PEM (code:004)"
  }
  var h = ASN1HEX.getPosArrayOfChildren_AtObj(g, a[7]);
  if (h.length != 1) {
    throw "malformed X.509 certificate PEM (code:005)"
  }
  if (g.substr(h[0], 2) != "30") {
    throw "malformed X.509 certificate PEM (code:006)"
  }
  var f = ASN1HEX.getPosArrayOfChildren_AtObj(g, h[0]);
  var e = f.length;
  var d = new Array(e);
  for (var c = 0; c < e; c++) {
    d[c] = X509.getV3ExtItemInfo_AtObj(g, f[c])
  }
  return d
};
X509.getV3ExtItemInfo_AtObj = function (f, g) {
  var e = {};
  e.posTLV = g;
  var b = ASN1HEX.getPosArrayOfChildren_AtObj(f, g);
  if (b.length != 2 && b.length != 3) {
    throw "malformed X.509v3 Ext (code:001)"
  }
  if (f.substr(b[0], 2) != "06") {
    throw "malformed X.509v3 Ext (code:002)"
  }
  var d = ASN1HEX.getHexOfV_AtObj(f, b[0]);
  e.oid = ASN1HEX.hextooidstr(d);
  e.critical = false;
  if (b.length == 3) {
    e.critical = true
  }
  var c = b[b.length - 1];
  if (f.substr(c, 2) != "04") {
    throw "malformed X.509v3 Ext (code:003)"
  }
  e.posV = ASN1HEX.getStartPosOfV_AtObj(f, c);
  return e
};
X509.getHexOfTLV_V3ExtValue = function (b, a) {
  var c = X509.getPosOfTLV_V3ExtValue(b, a);
  if (c == -1) {
    return null
  }
  return ASN1HEX.getHexOfTLV_AtObj(b, c)
};
X509.getHexOfV_V3ExtValue = function (b, a) {
  var c = X509.getPosOfTLV_V3ExtValue(b, a);
  if (c == -1) {
    return null
  }
  return ASN1HEX.getHexOfV_AtObj(b, c)
};
X509.getPosOfTLV_V3ExtValue = function (f, b) {
  var d = b;
  if (!b.match(/^[0-9.]+$/)) {
    d = KJUR.asn1.x509.OID.name2oid(b)
  }
  if (d == "") {
    return - 1
  }
  var c = X509.getV3ExtInfoListOfCertHex(f);
  for (var a = 0; a < c.length; a++) {
    var e = c[a];
    if (e.oid == d) {
      return e.posV
    }
  }
  return - 1
};
X509.getExtBasicConstraints = function (d) {
  var a = X509.getHexOfV_V3ExtValue(d, "basicConstraints");
  if (a === null) {
    return null
  }
  if (a === "") {
    return {}
  }
  if (a === "0101ff") {
    return {
      cA: true
    }
  }
  if (a.substr(0, 8) === "0101ff02") {
    var c = ASN1HEX.getHexOfV_AtObj(a, 6);
    var b = parseInt(c, 16);
    return {
      cA: true,
      pathLen: b
    }
  }
  throw "unknown error"
};
X509.KEYUSAGE_NAME = ["digitalSignature", "nonRepudiation", "keyEncipherment", "dataEncipherment", "keyAgreement", "keyCertSign", "cRLSign", "encipherOnly", "decipherOnly"];
X509.getExtKeyUsageBin = function (d) {
  var b = X509.getHexOfV_V3ExtValue(d, "keyUsage");
  if (b == "") {
    return ""
  }
  if (b.length % 2 != 0 || b.length <= 2) {
    throw "malformed key usage value"
  }
  var a = parseInt(b.substr(0, 2));
  var c = parseInt(b.substr(2), 16).toString(2);
  return c.substr(0, c.length - a)
};
X509.getExtKeyUsageString = function (e) {
  var d = X509.getExtKeyUsageBin(e);
  var b = new Array();
  for (var c = 0; c < d.length; c++) {
    if (d.substr(c, 1) == "1") {
      b.push(X509.KEYUSAGE_NAME[c])
    }
  }
  return b.join(",")
};
X509.getExtSubjectKeyIdentifier = function (b) {
  var a = X509.getHexOfV_V3ExtValue(b, "subjectKeyIdentifier");
  return a
};
X509.getExtAuthorityKeyIdentifier = function (f) {
  var b = {};
  var e = X509.getHexOfTLV_V3ExtValue(f, "authorityKeyIdentifier");
  if (e === null) {
    return null
  }
  var c = ASN1HEX.getPosArrayOfChildren_AtObj(e, 0);
  for (var d = 0; d < c.length; d++) {
    if (e.substr(c[d], 2) === "80") {
      b.kid = ASN1HEX.getHexOfV_AtObj(e, c[d])
    }
  }
  return b
};
X509.getExtExtKeyUsageName = function (k) {
  var b = new Array();
  var f = X509.getHexOfTLV_V3ExtValue(k, "extKeyUsage");
  if (f === null) {
    return null
  }
  var c = ASN1HEX.getPosArrayOfChildren_AtObj(f, 0);
  for (var e = 0; e < c.length; e++) {
    var j = ASN1HEX.getHexOfV_AtObj(f, c[e]);
    var g = KJUR.asn1.ASN1Util.oidHexToInt(j);
    var d = KJUR.asn1.x509.OID.oid2name(g);
    b.push(d)
  }
  return b
};
X509.getExtSubjectAltName = function (g) {
  var b = new Array();
  var f = X509.getHexOfTLV_V3ExtValue(g, "subjectAltName");
  var c = ASN1HEX.getPosArrayOfChildren_AtObj(f, 0);
  for (var e = 0; e < c.length; e++) {
    if (f.substr(c[e], 2) === "82") {
      var d = hextoutf8(ASN1HEX.getHexOfV_AtObj(f, c[e]));
      b.push(d)
    }
  }
  return b
};
X509.getExtCRLDistributionPointsURI = function (n) {
  var p = new Array();
  var k = X509.getHexOfTLV_V3ExtValue(n, "cRLDistributionPoints");
  var o = ASN1HEX.getPosArrayOfChildren_AtObj(k, 0);
  for (var g = 0; g < o.length; g++) {
    var l = ASN1HEX.getHexOfTLV_AtObj(k, o[g]);
    var b = ASN1HEX.getPosArrayOfChildren_AtObj(l, 0);
    for (var e = 0; e < b.length; e++) {
      if (l.substr(b[e], 2) === "a0") {
        var f = ASN1HEX.getHexOfV_AtObj(l, b[e]);
        if (f.substr(0, 2) === "a0") {
          var c = ASN1HEX.getHexOfV_AtObj(f, 0);
          if (c.substr(0, 2) === "86") {
            var m = ASN1HEX.getHexOfV_AtObj(c, 0);
            var d = hextoutf8(m);
            p.push(d)
          }
        }
      }
    }
  }
  return p
};
X509.getExtAIAInfo = function (g) {
  var j = {};
  j.ocsp = [];
  j.caissuer = [];
  var h = X509.getPosOfTLV_V3ExtValue(g, "authorityInfoAccess");
  if (h == -1) {
    return null
  }
  if (g.substr(h, 2) != "30") {
    throw "malformed AIA Extn Value"
  }
  var d = ASN1HEX.getPosArrayOfChildren_AtObj(g, h);
  for (var c = 0; c < d.length; c++) {
    var a = d[c];
    var b = ASN1HEX.getPosArrayOfChildren_AtObj(g, a);
    if (b.length != 2) {
      throw "malformed AccessDescription of AIA Extn"
    }
    var e = b[0];
    var f = b[1];
    if (ASN1HEX.getHexOfV_AtObj(g, e) == "2b06010505073001") {
      if (g.substr(f, 2) == "86") {
        j.ocsp.push(hextoutf8(ASN1HEX.getHexOfV_AtObj(g, f)))
      }
    }
    if (ASN1HEX.getHexOfV_AtObj(g, e) == "2b06010505073002") {
      if (g.substr(f, 2) == "86") {
        j.caissuer.push(hextoutf8(ASN1HEX.getHexOfV_AtObj(g, f)))
      }
    }
  }
  return j
};
X509.getSignatureAlgorithmName = function (d) {
  var b = ASN1HEX.getDecendantHexVByNthList(d, 0, [1, 0]);
  var a = KJUR.asn1.ASN1Util.oidHexToInt(b);
  var c = KJUR.asn1.x509.OID.oid2name(a);
  return c
};
X509.getSignatureValueHex = function (b) {
  var a = ASN1HEX.getDecendantHexVByNthList(b, 0, [2]);
  if (a.substr(0, 2) !== "00") {
    throw "can't get signature value"
  }
  return a.substr(2)
};
X509.getSerialNumberHex = function (a) {
  return ASN1HEX.getDecendantHexVByNthList(a, 0, [0, 1])
};
X509.verifySignature = function (f, c) {
  var d = X509.getSignatureAlgorithmName(f);
  var a = X509.getSignatureValueHex(f);
  var b = ASN1HEX.getDecendantHexTLVByNthList(f, 0, [0]);
  var e = new KJUR.crypto.Signature({
    alg: d
  });
  e.init(c);
  e.updateHex(b);
  return e.verify(a)
};
/*! jws-3.3.5 (c) 2013-2016 Kenji Urushima | kjur.github.com/jsrsasign/license
 */
if (typeof KJUR == "undefined" || !KJUR) {
  KJUR = {}
}
if (typeof KJUR.jws == "undefined" || !KJUR.jws) {
  KJUR.jws = {}
}
KJUR.jws.JWS = function () {
  var a = KJUR.jws.JWS;
  this.parseJWS = function (e, h) {
    if ((this.parsedJWS !== undefined) && (h || (this.parsedJWS.sigvalH !== undefined))) {
      return
    }
    var g = e.match(/^([^.]+)\.([^.]+)\.([^.]+)$/);
    if (g == null) {
      throw "JWS signature is not a form of 'Head.Payload.SigValue'."
    }
    var i = g[1];
    var c = g[2];
    var j = g[3];
    var l = i + "." + c;
    this.parsedJWS = {};
    this.parsedJWS.headB64U = i;
    this.parsedJWS.payloadB64U = c;
    this.parsedJWS.sigvalB64U = j;
    this.parsedJWS.si = l;
    if (!h) {
      var f = b64utohex(j);
      var d = parseBigInt(f, 16);
      this.parsedJWS.sigvalH = f;
      this.parsedJWS.sigvalBI = d
    }
    var b = b64utoutf8(i);
    var k = b64utoutf8(c);
    this.parsedJWS.headS = b;
    this.parsedJWS.payloadS = k;
    if (!a.isSafeJSONString(b, this.parsedJWS, "headP")) {
      throw "malformed JSON string for JWS Head: " + b
    }
  }
};
KJUR.jws.JWS.sign = function (a, i, c, m, l) {
  var k = KJUR.jws.JWS;
  var q, e, j;
  if (typeof i != "string" && typeof i != "object") {
    throw "spHeader must be JSON string or object: " + i
  }
  if (typeof i == "object") {
    e = i;
    q = JSON.stringify(e)
  }
  if (typeof i == "string") {
    q = i;
    if (!k.isSafeJSONString(q)) {
      throw "JWS Head is not safe JSON string: " + q
    }
    e = k.readSafeJSONString(q)
  }
  j = c;
  if (typeof c == "object") {
    j = JSON.stringify(c)
  }
  if ((a == "" || a == null) && e.alg !== undefined) {
    a = e.alg
  }
  if ((a != "" && a != null) && e.alg === undefined) {
    e.alg = a;
    q = JSON.stringify(e)
  }
  if (a !== e.alg) {
    throw "alg and sHeader.alg doesn't match: " + a + "!=" + e.alg
  }
  var d = null;
  if (k.jwsalg2sigalg[a] === undefined) {
    throw "unsupported alg name: " + a
  } else {
    d = k.jwsalg2sigalg[a]
  }
  var b = utf8tob64u(q);
  var g = utf8tob64u(j);
  var o = b + "." + g;
  var n = "";
  if (d.substr(0, 4) == "Hmac") {
    if (m === undefined) {
      throw "mac key shall be specified for HS* alg"
    }
    var h = new KJUR.crypto.Mac({
      alg: d,
      prov: "cryptojs",
      pass: m
    });
    h.updateString(o);
    n = h.doFinal()
  } else {
    if (d.indexOf("withECDSA") != -1) {
      var p = new KJUR.crypto.Signature({
        alg: d
      });
      p.init(m, l);
      p.updateString(o);
      hASN1Sig = p.sign();
      n = KJUR.crypto.ECDSA.asn1SigToConcatSig(hASN1Sig)
    } else {
      if (d != "none") {
        var p = new KJUR.crypto.Signature({
          alg: d
        });
        p.init(m, l);
        p.updateString(o);
        n = p.sign()
      }
    }
  }
  var f = hextob64u(n);
  return o + "." + f
};
KJUR.jws.JWS.verify = function (p, t, j) {
  var m = KJUR.jws.JWS;
  var q = p.split(".");
  var d = q[0];
  var l = q[1];
  var b = d + "." + l;
  var r = b64utohex(q[2]);
  var i = m.readSafeJSONString(b64utoutf8(q[0]));
  var h = null;
  var s = null;
  if (i.alg === undefined) {
    throw "algorithm not specified in header"
  } else {
    h = i.alg;
    s = h.substr(0, 2)
  }
  if (j != null && Object.prototype.toString.call(j) === "[object Array]" && j.length > 0) {
    var c = ":" + j.join(":") + ":";
    if (c.indexOf(":" + h + ":") == -1) {
      throw "algorithm '" + h + "' not accepted in the list"
    }
  }
  if (h != "none" && t === null) {
    throw "key shall be specified to verify."
  }
  if (typeof t == "string" && t.indexOf("-----BEGIN ") != -1) {
    t = KEYUTIL.getKey(t)
  }
  if (s == "RS" || s == "PS") {
    if (!(t instanceof RSAKey)) {
      throw "key shall be a RSAKey obj for RS* and PS* algs"
    }
  }
  if (s == "ES") {
    if (!(t instanceof KJUR.crypto.ECDSA)) {
      throw "key shall be a ECDSA obj for ES* algs"
    }
  }
  if (h == "none") { }
  var n = null;
  if (m.jwsalg2sigalg[i.alg] === undefined) {
    throw "unsupported alg name: " + h
  } else {
    n = m.jwsalg2sigalg[h]
  }
  if (n == "none") {
    throw "not supported"
  } else {
    if (n.substr(0, 4) == "Hmac") {
      var k = null;
      if (t === undefined) {
        throw "hexadecimal key shall be specified for HMAC"
      }
      var g = new KJUR.crypto.Mac({
        alg: n,
        pass: t
      });
      g.updateString(b);
      k = g.doFinal();
      return r == k
    } else {
      if (n.indexOf("withECDSA") != -1) {
        var f = null;
        try {
          f = KJUR.crypto.ECDSA.concatSigToASN1Sig(r)
        } catch (o) {
          return false
        }
        var e = new KJUR.crypto.Signature({
          alg: n
        });
        e.init(t);
        e.updateString(b);
        return e.verify(f)
      } else {
        var e = new KJUR.crypto.Signature({
          alg: n
        });
        e.init(t);
        e.updateString(b);
        return e.verify(r)
      }
    }
  }
};
KJUR.jws.JWS.parse = function (g) {
  var c = g.split(".");
  var b = {};
  var f, e, d;
  if (c.length != 2 && c.length != 3) {
    throw "malformed sJWS: wrong number of '.' splitted elements"
  }
  f = c[0];
  e = c[1];
  if (c.length == 3) {
    d = c[2]
  }
  b.headerObj = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(f));
  b.payloadObj = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(e));
  b.headerPP = JSON.stringify(b.headerObj, null, "  ");
  if (b.payloadObj == null) {
    b.payloadPP = b64utoutf8(e)
  } else {
    b.payloadPP = JSON.stringify(b.payloadObj, null, "  ")
  }
  if (d !== undefined) {
    b.sigHex = b64utohex(d)
  }
  return b
};
KJUR.jws.JWS.verifyJWT = function (d, j, l) {
  var h = KJUR.jws.JWS;
  var i = d.split(".");
  var c = i[0];
  var g = i[1];
  var m = c + "." + g;
  var k = b64utohex(i[2]);
  var f = h.readSafeJSONString(b64utoutf8(c));
  var e = h.readSafeJSONString(b64utoutf8(g));
  if (f.alg === undefined) {
    return false
  }
  if (l.alg === undefined) {
    throw "acceptField.alg shall be specified"
  }
  if (!h.inArray(f.alg, l.alg)) {
    return false
  }
  if (e.iss !== undefined && typeof l.iss === "object") {
    if (!h.inArray(e.iss, l.iss)) {
      return false
    }
  }
  if (e.sub !== undefined && typeof l.sub === "object") {
    if (!h.inArray(e.sub, l.sub)) {
      return false
    }
  }
  if (e.aud !== undefined && typeof l.aud === "object") {
    if (typeof e.aud == "string") {
      if (!h.inArray(e.aud, l.aud)) {
        return false
      }
    } else {
      if (typeof e.aud == "object") {
        if (!h.includedArray(e.aud, l.aud)) {
          return false
        }
      }
    }
  }
  var b = KJUR.jws.IntDate.getNow();
  if (l.verifyAt !== undefined && typeof l.verifyAt === "number") {
    b = l.verifyAt
  }
  if (l.gracePeriod === undefined || typeof l.gracePeriod !== "number") {
    l.gracePeriod = 0
  }
  if (e.exp !== undefined && typeof e.exp == "number") {
    if (e.exp + l.gracePeriod < b) {
      return false
    }
  }
  if (e.nbf !== undefined && typeof e.nbf == "number") {
    if (b < e.nbf - l.gracePeriod) {
      return false
    }
  }
  if (e.iat !== undefined && typeof e.iat == "number") {
    if (b < e.iat - l.gracePeriod) {
      return false
    }
  }
  if (e.jti !== undefined && l.jti !== undefined) {
    if (e.jti !== l.jti) {
      return false
    }
  }
  if (!KJUR.jws.JWS.verify(d, j, l.alg)) {
    return false
  }
  return true
};
KJUR.jws.JWS.includedArray = function (b, a) {
  var d = KJUR.jws.JWS.inArray;
  if (b === null) {
    return false
  }
  if (typeof b !== "object") {
    return false
  }
  if (typeof b.length !== "number") {
    return false
  }
  for (var c = 0; c < b.length; c++) {
    if (!d(b[c], a)) {
      return false
    }
  }
  return true
};
KJUR.jws.JWS.inArray = function (d, b) {
  if (b === null) {
    return false
  }
  if (typeof b !== "object") {
    return false
  }
  if (typeof b.length !== "number") {
    return false
  }
  for (var c = 0; c < b.length; c++) {
    if (b[c] == d) {
      return true
    }
  }
  return false
};

/*rsa end */

class Cryptico {
  constructor() {
  }

  setKeyManager(manager) {
    this.keyManager = manager;
  }

  random(min, max, nums) {
    max += 1;
    var arr1 = [];
    var loopfor = 0;
    if (nums === undefined) {
      loopfor = 1;
    } else {
      loopfor = nums;
    }
    for (var i = 0; i < loopfor; i++) {
      var randomnumtmp = Math.floor((Math.random() * (max - min)) + min);
      arr1.push(randomnumtmp);
    }
    return arr1;
  };

  randomKey(size) {
    if (!this.keyManager) {
      throw new Error('key manager is not set yet')
    }

    if (!this.keyManager.setKeyHex) {
      throw new Error('setKeyHex method of keyManager is not defined')
    }

    if (!this.keyManager.getKeyHex) {
      throw new Error('getKeyHex method of keyManager is not defined')
    }
    //get saved key
    var sk = this.keyManager.getKeyHex();
    if (sk && sk.length > 10) {
      var key = aesjs.utils.hex.toBytes(sk);
      return key;
    }
    var aesk = this.random(1, 127, size);
    var keyhex = aesjs.utils.hex.fromBytes(aesk)
    this.keyManager.setKeyHex(keyhex);
    return aesk
  }


  decryptData(data) {
    if (!data || data.length == 0) {
      throw new Error("invalid data");
    }

    if (!this.keyManager) {
      throw new Error('key manager is not set yet')
    }

    if (!this.keyManager.getKeyHex) {
      throw new Error('getKeyHex method of keyManager is not defined')
    }

    var value = this.keyManager.getKeyHex();
    if (value) {
      var key = aesjs.utils.hex.toBytes(value);
      var success = true;
      var result;
      try {
        var aes = new aesjs.ModeOfOperation.ecb(key);
        var data1 = b64toBA(data);
        var decryptedBytes = aes.decrypt(data1);
        decryptedBytes = aesjs.padding.pkcs7.strip(decryptedBytes);
        result = aesjs.utils.utf8.fromBytes(decryptedBytes);
      } catch (err) {
        success = false;
        result = err;
      }
      return { status: success, plaintext: result };
    } else {
      throw new Error("keymanager err.get keyhex failed.");
    }
  }

  b256to64(t) {
    var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var a, c, n;
    var r = '', l = 0, s = 0;
    var tl = t.length;
    for (n = 0; n < tl; n++) {
      c = t.charCodeAt(n);
      if (s == 0) {
        r += base64Chars.charAt((c >> 2) & 63);
        a = (c & 3) << 4;
      }
      else if (s == 1) {
        r += base64Chars.charAt((a | (c >> 4) & 15));
        a = (c & 15) << 2;
      }
      else if (s == 2) {
        r += base64Chars.charAt(a | ((c >> 6) & 3));
        l += 1;
        r += base64Chars.charAt(c & 63);
      }
      l += 1;
      s += 1;
      if (s == 3) s = 0;
    }
    if (s > 0) {
      r += base64Chars.charAt(a);
      l += 1;
      r += '=';
      l += 1;
    }
    if (s == 1) {
      r += '=';
    }
    return r;
  }

  encryptV1(pwd, nB64) {
    if (!pwd || pwd.length == 0) {
      throw new Error("invalid pwd");
    }
    var cipherblock = "";
    var v1;
    try {
      var md5 = CryptoJS.algo.MD5.create();
      md5.update(pwd);
      v1 = md5.finalize();
      v1 = v1.toString();
      var rsa = new RSAKey();
      var nHex = b64tohex(nB64);
      rsa.setPublic(nHex, '3');
      var b64 = this.b256to64(v1);
      var bytes = b64toBA(b64);
      var enc = rsa.encrypt(bytes)
      cipherblock = hex2b64(enc)
    }
    catch (err) {
      return { status: err };
    }
    return { status: "success", cipher: cipherblock + "_" + v1};
  }

  encryptData(nB64, shak, text) {
    var success = true
    var result = ''
    try {
      var rsa = new RSAKey();
      var nHex = b64tohex(nB64);
      rsa.setPublic(nHex, '3');
      var aesk = this.randomKey(32);
      var enc = rsa.encrypt(aesk)
      enc = hex2b64(enc)
      var textBytes = aesjs.utils.utf8.toBytes(text);
      textBytes = aesjs.padding.pkcs7.pad(textBytes);
      var aesEcb = new aesjs.ModeOfOperation.ecb(aesk);
      var encryptedBytes = aesEcb.encrypt(textBytes);
      var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes)
      var ecnB64 = hex2b64(encryptedHex);
      var req = { version: 2, key: enc, data: ecnB64, shakey: shak };
      result = { status: success, cipher: req };
    } catch (e) {
      success = false
      result = { status: success, cipher: e.message };
    }
    return result;
  }

}
var cryptico = new Cryptico();

module.exports = { cryptico: cryptico }