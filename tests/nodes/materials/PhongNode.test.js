var Three = (function (exports) {
	'use strict';

	/**
	 * @author alteredq / http://alteredqualia.com/
	 * @author mrdoob / http://mrdoob.com/
	 */

	var _Math = {

		DEG2RAD: Math.PI / 180,
		RAD2DEG: 180 / Math.PI,

		generateUUID: function () {

			// http://www.broofa.com/Tools/Math.uuid.htm
			// Replaced .join with string concatenation (@takahirox)

			var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split( '' );
			var rnd = 0, r;

			return function generateUUID() {

				var uuid = '';

				for ( var i = 0; i < 36; i ++ ) {

					if ( i === 8 || i === 13 || i === 18 || i === 23 ) {

						uuid += '-';

					} else if ( i === 14 ) {

						uuid += '4';

					} else {

						if ( rnd <= 0x02 ) rnd = 0x2000000 + ( Math.random() * 0x1000000 ) | 0;
						r = rnd & 0xf;
						rnd = rnd >> 4;
						uuid += chars[ ( i === 19 ) ? ( r & 0x3 ) | 0x8 : r ];

					}

				}

				return uuid;

			};

		}(),

		clamp: function ( value, min, max ) {

			return Math.max( min, Math.min( max, value ) );

		},

		// compute euclidian modulo of m % n
		// https://en.wikipedia.org/wiki/Modulo_operation

		euclideanModulo: function ( n, m ) {

			return ( ( n % m ) + m ) % m;

		},

		// Linear mapping from range <a1, a2> to range <b1, b2>

		mapLinear: function ( x, a1, a2, b1, b2 ) {

			return b1 + ( x - a1 ) * ( b2 - b1 ) / ( a2 - a1 );

		},

		// https://en.wikipedia.org/wiki/Linear_interpolation

		lerp: function ( x, y, t ) {

			return ( 1 - t ) * x + t * y;

		},

		// http://en.wikipedia.org/wiki/Smoothstep

		smoothstep: function ( x, min, max ) {

			if ( x <= min ) return 0;
			if ( x >= max ) return 1;

			x = ( x - min ) / ( max - min );

			return x * x * ( 3 - 2 * x );

		},

		smootherstep: function ( x, min, max ) {

			if ( x <= min ) return 0;
			if ( x >= max ) return 1;

			x = ( x - min ) / ( max - min );

			return x * x * x * ( x * ( x * 6 - 15 ) + 10 );

		},

		// Random integer from <low, high> interval

		randInt: function ( low, high ) {

			return low + Math.floor( Math.random() * ( high - low + 1 ) );

		},

		// Random float from <low, high> interval

		randFloat: function ( low, high ) {

			return low + Math.random() * ( high - low );

		},

		// Random float from <-range/2, range/2> interval

		randFloatSpread: function ( range ) {

			return range * ( 0.5 - Math.random() );

		},

		degToRad: function ( degrees ) {

			return degrees * _Math.DEG2RAD;

		},

		radToDeg: function ( radians ) {

			return radians * _Math.RAD2DEG;

		},

		isPowerOfTwo: function ( value ) {

			return ( value & ( value - 1 ) ) === 0 && value !== 0;

		},

		ceilPowerOfTwo: function ( value ) {

			return Math.pow( 2, Math.ceil( Math.log( value ) / Math.LN2 ) );

		},

		floorPowerOfTwo: function ( value ) {

			return Math.pow( 2, Math.floor( Math.log( value ) / Math.LN2 ) );

		}

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var GLNode = function( type ) {

		this.uuid = _Math.generateUUID();

		this.allows = {};
		this.requestUpdate = false;

		this.type = type;

	};

	GLNode.prototype.parse = function( builder, context ) {

		context = context || {};

		builder.parsing = true;

		var material = builder.material;

		this.build( builder.addCache( context.cache, context.requires ).addSlot( context.slot ), 'v4' );

		material.clearVertexNode();
		material.clearFragmentNode();

		builder.removeCache().removeSlot();

		builder.parsing = false;

	};

	GLNode.prototype.parseAndBuildCode = function( builder, output, context ) {

		context = context || {};

		this.parse( builder, context );

		return this.buildCode( builder, output, context );

	};

	GLNode.prototype.buildCode = function( builder, output, context ) {

		context = context || {};

		var material = builder.material;

		var data = { result : this.build( builder.addCache( context.cache, context.requires ).addSlot( context.slot ), output ) };

		if ( builder.isShader( 'vertex' ) ) data.code = material.clearVertexNode();
		else data.code = material.clearFragmentNode();

		builder.removeCache().removeSlot();

		return data;

	};

	GLNode.prototype.build = function( builder, output, uuid ) {

		output = output || this.getType( builder, output );

		var material = builder.material, data = material.getDataNode( uuid || this.uuid );

		if ( builder.parsing ) this.appendDepsNode( builder, data, output );

		if ( this.allows[ builder.shader ] === false ) {

			throw new Error( 'Shader ' + shader + ' is not compatible with this node.' );

		}

		if ( this.requestUpdate && material.requestUpdate.indexOf( this ) === - 1 ) {

			material.requestUpdate.push( this );

		}

		return this.generate( builder, output, uuid );

	};

	GLNode.prototype.appendDepsNode = function( builder, data, output ) {

		data.deps = ( data.deps || 0 ) + 1;

		var outputLen = builder.getFormatLength( output );

		if ( outputLen > ( data.outputMax || 0 ) || this.getType( builder, output ) ) {

			data.outputMax = outputLen;
			data.output = output;

		}

	};

	GLNode.prototype.getType = function( builder, output ) {

		return output === 'sampler2D' || output === 'samplerCube' ? output : this.type;

	};

	/**
	 * Automatic node cache
	 * @author sunag / http://www.sunag.com.br/
	 */

	var TempNode = function( type, params ) {

		GLNode.call( this, type );

		params = params || {};

		this.shared = params.shared !== undefined ? params.shared : true;
		this.unique = params.unique !== undefined ? params.unique : false;

	};

	TempNode.prototype = Object.create( GLNode.prototype );
	TempNode.prototype.constructor = TempNode;

	TempNode.prototype.build = function( builder, output, uuid, ns ) {

		output = output || this.getType( builder );

		var material = builder.material;

		if ( this.isShared( builder, output ) ) {

			var isUnique = this.isUnique( builder, output );

			if ( isUnique && this.constructor.uuid === undefined ) {

				this.constructor.uuid = Math.generateUUID();

			}

			uuid = builder.getUuid( uuid || this.getUuid(), ! isUnique );

			var data = material.getDataNode( uuid );

			if ( builder.parsing ) {

				if ( data.deps || 0 > 0 ) {

					this.appendDepsNode( builder, data, output );

					return this.generate( builder, type, uuid );

				}

				return GLNode.prototype.build.call( this, builder, output, uuid );

			} else if ( isUnique ) {

				data.name = data.name || GLNode.prototype.build.call( this, builder, output, uuid );

				return data.name;

			} else if ( ! builder.optimize || data.deps == 1 ) {

				return GLNode.prototype.build.call( this, builder, output, uuid );

			}

			uuid = this.getUuid( false );

			var name = this.getTemp( builder, uuid );
			var type = data.output || this.getType( builder );

			if ( name ) {

				return builder.format( name, type, output );

			} else {

				name = TempNode.prototype.generate.call( this, builder, output, uuid, data.output, ns );

				var code = this.generate( builder, type, uuid );

				if ( builder.isShader( 'vertex' ) ) material.addVertexNode( name + '=' + code + ';' );
				else material.addFragmentNode( name + '=' + code + ';' );

				return builder.format( name, type, output );

			}

		}

		return GLNode.prototype.build.call( this, builder, output, uuid );

	};

	TempNode.prototype.isShared = function( builder, output ) {

		return output !== 'sampler2D' && output !== 'samplerCube' && this.shared;

	};

	TempNode.prototype.isUnique = function( builder, output ) {

		return this.unique;

	};

	TempNode.prototype.getUuid = function( unique ) {

		var uuid = unique || unique == undefined ? this.constructor.uuid || this.uuid : this.uuid;

		if ( typeof this.scope == "string" ) uuid = this.scope + '-' + uuid;

		return uuid;

	};

	TempNode.prototype.getTemp = function( builder, uuid ) {

		uuid = uuid || this.uuid;

		var material = builder.material;

		if ( builder.isShader( 'vertex' ) && material.vertexTemps[ uuid ] ) return material.vertexTemps[ uuid ].name;
		else if ( material.fragmentTemps[ uuid ] ) return material.fragmentTemps[ uuid ].name;

	};

	TempNode.prototype.generate = function( builder, output, uuid, type, ns ) {

		if ( ! this.isShared( builder, output ) ) console.error( "TempNode is not shared!" );

		uuid = uuid || this.uuid;

		if ( builder.isShader( 'vertex' ) ) return builder.material.getVertexTemp( uuid, type || this.getType( builder ), ns ).name;
		else return builder.material.getFragmentTemp( uuid, type || this.getType( builder ), ns ).name;

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var InputNode = function( type, params ) {

		params = params || {};
		params.shared = params.shared !== undefined ? params.shared : false;

		TempNode.call( this, type, params );

	};

	InputNode.prototype = Object.create( TempNode.prototype );
	InputNode.prototype.constructor = InputNode;

	InputNode.prototype.generate = function( builder, output, uuid, type, ns, needsUpdate ) {

		var material = builder.material;

		uuid = builder.getUuid( uuid || this.getUuid() );
		type = type || this.getType( builder );

		var data = material.getDataNode( uuid );

		if ( builder.isShader( 'vertex' ) ) {

			if ( ! data.vertex ) {

				data.vertex = material.createVertexUniform( type, this.value, ns, needsUpdate );

			}

			return builder.format( data.vertex.name, type, output );

		} else {

			if ( ! data.fragment ) {

				data.fragment = material.createFragmentUniform( type, this.value, ns, needsUpdate );

			}

			return builder.format( data.fragment.name, type, output );

		}

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 */

	var ColorKeywords = { 'aliceblue': 0xF0F8FF, 'antiquewhite': 0xFAEBD7, 'aqua': 0x00FFFF, 'aquamarine': 0x7FFFD4, 'azure': 0xF0FFFF,
		'beige': 0xF5F5DC, 'bisque': 0xFFE4C4, 'black': 0x000000, 'blanchedalmond': 0xFFEBCD, 'blue': 0x0000FF, 'blueviolet': 0x8A2BE2,
		'brown': 0xA52A2A, 'burlywood': 0xDEB887, 'cadetblue': 0x5F9EA0, 'chartreuse': 0x7FFF00, 'chocolate': 0xD2691E, 'coral': 0xFF7F50,
		'cornflowerblue': 0x6495ED, 'cornsilk': 0xFFF8DC, 'crimson': 0xDC143C, 'cyan': 0x00FFFF, 'darkblue': 0x00008B, 'darkcyan': 0x008B8B,
		'darkgoldenrod': 0xB8860B, 'darkgray': 0xA9A9A9, 'darkgreen': 0x006400, 'darkgrey': 0xA9A9A9, 'darkkhaki': 0xBDB76B, 'darkmagenta': 0x8B008B,
		'darkolivegreen': 0x556B2F, 'darkorange': 0xFF8C00, 'darkorchid': 0x9932CC, 'darkred': 0x8B0000, 'darksalmon': 0xE9967A, 'darkseagreen': 0x8FBC8F,
		'darkslateblue': 0x483D8B, 'darkslategray': 0x2F4F4F, 'darkslategrey': 0x2F4F4F, 'darkturquoise': 0x00CED1, 'darkviolet': 0x9400D3,
		'deeppink': 0xFF1493, 'deepskyblue': 0x00BFFF, 'dimgray': 0x696969, 'dimgrey': 0x696969, 'dodgerblue': 0x1E90FF, 'firebrick': 0xB22222,
		'floralwhite': 0xFFFAF0, 'forestgreen': 0x228B22, 'fuchsia': 0xFF00FF, 'gainsboro': 0xDCDCDC, 'ghostwhite': 0xF8F8FF, 'gold': 0xFFD700,
		'goldenrod': 0xDAA520, 'gray': 0x808080, 'green': 0x008000, 'greenyellow': 0xADFF2F, 'grey': 0x808080, 'honeydew': 0xF0FFF0, 'hotpink': 0xFF69B4,
		'indianred': 0xCD5C5C, 'indigo': 0x4B0082, 'ivory': 0xFFFFF0, 'khaki': 0xF0E68C, 'lavender': 0xE6E6FA, 'lavenderblush': 0xFFF0F5, 'lawngreen': 0x7CFC00,
		'lemonchiffon': 0xFFFACD, 'lightblue': 0xADD8E6, 'lightcoral': 0xF08080, 'lightcyan': 0xE0FFFF, 'lightgoldenrodyellow': 0xFAFAD2, 'lightgray': 0xD3D3D3,
		'lightgreen': 0x90EE90, 'lightgrey': 0xD3D3D3, 'lightpink': 0xFFB6C1, 'lightsalmon': 0xFFA07A, 'lightseagreen': 0x20B2AA, 'lightskyblue': 0x87CEFA,
		'lightslategray': 0x778899, 'lightslategrey': 0x778899, 'lightsteelblue': 0xB0C4DE, 'lightyellow': 0xFFFFE0, 'lime': 0x00FF00, 'limegreen': 0x32CD32,
		'linen': 0xFAF0E6, 'magenta': 0xFF00FF, 'maroon': 0x800000, 'mediumaquamarine': 0x66CDAA, 'mediumblue': 0x0000CD, 'mediumorchid': 0xBA55D3,
		'mediumpurple': 0x9370DB, 'mediumseagreen': 0x3CB371, 'mediumslateblue': 0x7B68EE, 'mediumspringgreen': 0x00FA9A, 'mediumturquoise': 0x48D1CC,
		'mediumvioletred': 0xC71585, 'midnightblue': 0x191970, 'mintcream': 0xF5FFFA, 'mistyrose': 0xFFE4E1, 'moccasin': 0xFFE4B5, 'navajowhite': 0xFFDEAD,
		'navy': 0x000080, 'oldlace': 0xFDF5E6, 'olive': 0x808000, 'olivedrab': 0x6B8E23, 'orange': 0xFFA500, 'orangered': 0xFF4500, 'orchid': 0xDA70D6,
		'palegoldenrod': 0xEEE8AA, 'palegreen': 0x98FB98, 'paleturquoise': 0xAFEEEE, 'palevioletred': 0xDB7093, 'papayawhip': 0xFFEFD5, 'peachpuff': 0xFFDAB9,
		'peru': 0xCD853F, 'pink': 0xFFC0CB, 'plum': 0xDDA0DD, 'powderblue': 0xB0E0E6, 'purple': 0x800080, 'rebeccapurple': 0x663399, 'red': 0xFF0000, 'rosybrown': 0xBC8F8F,
		'royalblue': 0x4169E1, 'saddlebrown': 0x8B4513, 'salmon': 0xFA8072, 'sandybrown': 0xF4A460, 'seagreen': 0x2E8B57, 'seashell': 0xFFF5EE,
		'sienna': 0xA0522D, 'silver': 0xC0C0C0, 'skyblue': 0x87CEEB, 'slateblue': 0x6A5ACD, 'slategray': 0x708090, 'slategrey': 0x708090, 'snow': 0xFFFAFA,
		'springgreen': 0x00FF7F, 'steelblue': 0x4682B4, 'tan': 0xD2B48C, 'teal': 0x008080, 'thistle': 0xD8BFD8, 'tomato': 0xFF6347, 'turquoise': 0x40E0D0,
		'violet': 0xEE82EE, 'wheat': 0xF5DEB3, 'white': 0xFFFFFF, 'whitesmoke': 0xF5F5F5, 'yellow': 0xFFFF00, 'yellowgreen': 0x9ACD32 };

	function Color( r, g, b ) {

		if ( g === undefined && b === undefined ) {

			// r is THREE.Color, hex or string
			return this.set( r );

		}

		return this.setRGB( r, g, b );

	}

	Object.assign( Color.prototype, {

		isColor: true,

		r: 1, g: 1, b: 1,

		set: function ( value ) {

			if ( value && value.isColor ) {

				this.copy( value );

			} else if ( typeof value === 'number' ) {

				this.setHex( value );

			} else if ( typeof value === 'string' ) {

				this.setStyle( value );

			}

			return this;

		},

		setScalar: function ( scalar ) {

			this.r = scalar;
			this.g = scalar;
			this.b = scalar;

			return this;

		},

		setHex: function ( hex ) {

			hex = Math.floor( hex );

			this.r = ( hex >> 16 & 255 ) / 255;
			this.g = ( hex >> 8 & 255 ) / 255;
			this.b = ( hex & 255 ) / 255;

			return this;

		},

		setRGB: function ( r, g, b ) {

			this.r = r;
			this.g = g;
			this.b = b;

			return this;

		},

		setHSL: function () {

			function hue2rgb( p, q, t ) {

				if ( t < 0 ) t += 1;
				if ( t > 1 ) t -= 1;
				if ( t < 1 / 6 ) return p + ( q - p ) * 6 * t;
				if ( t < 1 / 2 ) return q;
				if ( t < 2 / 3 ) return p + ( q - p ) * 6 * ( 2 / 3 - t );
				return p;

			}

			return function setHSL( h, s, l ) {

				// h,s,l ranges are in 0.0 - 1.0
				h = _Math.euclideanModulo( h, 1 );
				s = _Math.clamp( s, 0, 1 );
				l = _Math.clamp( l, 0, 1 );

				if ( s === 0 ) {

					this.r = this.g = this.b = l;

				} else {

					var p = l <= 0.5 ? l * ( 1 + s ) : l + s - ( l * s );
					var q = ( 2 * l ) - p;

					this.r = hue2rgb( q, p, h + 1 / 3 );
					this.g = hue2rgb( q, p, h );
					this.b = hue2rgb( q, p, h - 1 / 3 );

				}

				return this;

			};

		}(),

		setStyle: function ( style ) {

			function handleAlpha( string ) {

				if ( string === undefined ) return;

				if ( parseFloat( string ) < 1 ) {

					console.warn( 'THREE.Color: Alpha component of ' + style + ' will be ignored.' );

				}

			}


			var m;

			if ( m = /^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/.exec( style ) ) {

				// rgb / hsl

				var color;
				var name = m[ 1 ];
				var components = m[ 2 ];

				switch ( name ) {

					case 'rgb':
					case 'rgba':

						if ( color = /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec( components ) ) {

							// rgb(255,0,0) rgba(255,0,0,0.5)
							this.r = Math.min( 255, parseInt( color[ 1 ], 10 ) ) / 255;
							this.g = Math.min( 255, parseInt( color[ 2 ], 10 ) ) / 255;
							this.b = Math.min( 255, parseInt( color[ 3 ], 10 ) ) / 255;

							handleAlpha( color[ 5 ] );

							return this;

						}

						if ( color = /^(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec( components ) ) {

							// rgb(100%,0%,0%) rgba(100%,0%,0%,0.5)
							this.r = Math.min( 100, parseInt( color[ 1 ], 10 ) ) / 100;
							this.g = Math.min( 100, parseInt( color[ 2 ], 10 ) ) / 100;
							this.b = Math.min( 100, parseInt( color[ 3 ], 10 ) ) / 100;

							handleAlpha( color[ 5 ] );

							return this;

						}

						break;

					case 'hsl':
					case 'hsla':

						if ( color = /^([0-9]*\.?[0-9]+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec( components ) ) {

							// hsl(120,50%,50%) hsla(120,50%,50%,0.5)
							var h = parseFloat( color[ 1 ] ) / 360;
							var s = parseInt( color[ 2 ], 10 ) / 100;
							var l = parseInt( color[ 3 ], 10 ) / 100;

							handleAlpha( color[ 5 ] );

							return this.setHSL( h, s, l );

						}

						break;

				}

			} else if ( m = /^\#([A-Fa-f0-9]+)$/.exec( style ) ) {

				// hex color

				var hex = m[ 1 ];
				var size = hex.length;

				if ( size === 3 ) {

					// #ff0
					this.r = parseInt( hex.charAt( 0 ) + hex.charAt( 0 ), 16 ) / 255;
					this.g = parseInt( hex.charAt( 1 ) + hex.charAt( 1 ), 16 ) / 255;
					this.b = parseInt( hex.charAt( 2 ) + hex.charAt( 2 ), 16 ) / 255;

					return this;

				} else if ( size === 6 ) {

					// #ff0000
					this.r = parseInt( hex.charAt( 0 ) + hex.charAt( 1 ), 16 ) / 255;
					this.g = parseInt( hex.charAt( 2 ) + hex.charAt( 3 ), 16 ) / 255;
					this.b = parseInt( hex.charAt( 4 ) + hex.charAt( 5 ), 16 ) / 255;

					return this;

				}

			}

			if ( style && style.length > 0 ) {

				// color keywords
				var hex = ColorKeywords[ style ];

				if ( hex !== undefined ) {

					// red
					this.setHex( hex );

				} else {

					// unknown color
					console.warn( 'THREE.Color: Unknown color ' + style );

				}

			}

			return this;

		},

		clone: function () {

			return new this.constructor( this.r, this.g, this.b );

		},

		copy: function ( color ) {

			this.r = color.r;
			this.g = color.g;
			this.b = color.b;

			return this;

		},

		copyGammaToLinear: function ( color, gammaFactor ) {

			if ( gammaFactor === undefined ) gammaFactor = 2.0;

			this.r = Math.pow( color.r, gammaFactor );
			this.g = Math.pow( color.g, gammaFactor );
			this.b = Math.pow( color.b, gammaFactor );

			return this;

		},

		copyLinearToGamma: function ( color, gammaFactor ) {

			if ( gammaFactor === undefined ) gammaFactor = 2.0;

			var safeInverse = ( gammaFactor > 0 ) ? ( 1.0 / gammaFactor ) : 1.0;

			this.r = Math.pow( color.r, safeInverse );
			this.g = Math.pow( color.g, safeInverse );
			this.b = Math.pow( color.b, safeInverse );

			return this;

		},

		convertGammaToLinear: function () {

			var r = this.r, g = this.g, b = this.b;

			this.r = r * r;
			this.g = g * g;
			this.b = b * b;

			return this;

		},

		convertLinearToGamma: function () {

			this.r = Math.sqrt( this.r );
			this.g = Math.sqrt( this.g );
			this.b = Math.sqrt( this.b );

			return this;

		},

		getHex: function () {

			return ( this.r * 255 ) << 16 ^ ( this.g * 255 ) << 8 ^ ( this.b * 255 ) << 0;

		},

		getHexString: function () {

			return ( '000000' + this.getHex().toString( 16 ) ).slice( - 6 );

		},

		getHSL: function ( optionalTarget ) {

			// h,s,l ranges are in 0.0 - 1.0

			var hsl = optionalTarget || { h: 0, s: 0, l: 0 };

			var r = this.r, g = this.g, b = this.b;

			var max = Math.max( r, g, b );
			var min = Math.min( r, g, b );

			var hue, saturation;
			var lightness = ( min + max ) / 2.0;

			if ( min === max ) {

				hue = 0;
				saturation = 0;

			} else {

				var delta = max - min;

				saturation = lightness <= 0.5 ? delta / ( max + min ) : delta / ( 2 - max - min );

				switch ( max ) {

					case r: hue = ( g - b ) / delta + ( g < b ? 6 : 0 ); break;
					case g: hue = ( b - r ) / delta + 2; break;
					case b: hue = ( r - g ) / delta + 4; break;

				}

				hue /= 6;

			}

			hsl.h = hue;
			hsl.s = saturation;
			hsl.l = lightness;

			return hsl;

		},

		getStyle: function () {

			return 'rgb(' + ( ( this.r * 255 ) | 0 ) + ',' + ( ( this.g * 255 ) | 0 ) + ',' + ( ( this.b * 255 ) | 0 ) + ')';

		},

		offsetHSL: function ( h, s, l ) {

			var hsl = this.getHSL();

			hsl.h += h; hsl.s += s; hsl.l += l;

			this.setHSL( hsl.h, hsl.s, hsl.l );

			return this;

		},

		add: function ( color ) {

			this.r += color.r;
			this.g += color.g;
			this.b += color.b;

			return this;

		},

		addColors: function ( color1, color2 ) {

			this.r = color1.r + color2.r;
			this.g = color1.g + color2.g;
			this.b = color1.b + color2.b;

			return this;

		},

		addScalar: function ( s ) {

			this.r += s;
			this.g += s;
			this.b += s;

			return this;

		},

		sub: function ( color ) {

			this.r = Math.max( 0, this.r - color.r );
			this.g = Math.max( 0, this.g - color.g );
			this.b = Math.max( 0, this.b - color.b );

			return this;

		},

		multiply: function ( color ) {

			this.r *= color.r;
			this.g *= color.g;
			this.b *= color.b;

			return this;

		},

		multiplyScalar: function ( s ) {

			this.r *= s;
			this.g *= s;
			this.b *= s;

			return this;

		},

		lerp: function ( color, alpha ) {

			this.r += ( color.r - this.r ) * alpha;
			this.g += ( color.g - this.g ) * alpha;
			this.b += ( color.b - this.b ) * alpha;

			return this;

		},

		equals: function ( c ) {

			return ( c.r === this.r ) && ( c.g === this.g ) && ( c.b === this.b );

		},

		fromArray: function ( array, offset ) {

			if ( offset === undefined ) offset = 0;

			this.r = array[ offset ];
			this.g = array[ offset + 1 ];
			this.b = array[ offset + 2 ];

			return this;

		},

		toArray: function ( array, offset ) {

			if ( array === undefined ) array = [];
			if ( offset === undefined ) offset = 0;

			array[ offset ] = this.r;
			array[ offset + 1 ] = this.g;
			array[ offset + 2 ] = this.b;

			return array;

		},

		toJSON: function () {

			return this.getHex();

		}

	} );

	/**
	 * https://github.com/mrdoob/eventdispatcher.js/
	 */

	function EventDispatcher() {}

	Object.assign( EventDispatcher.prototype, {

		addEventListener: function ( type, listener ) {

			if ( this._listeners === undefined ) this._listeners = {};

			var listeners = this._listeners;

			if ( listeners[ type ] === undefined ) {

				listeners[ type ] = [];

			}

			if ( listeners[ type ].indexOf( listener ) === - 1 ) {

				listeners[ type ].push( listener );

			}

		},

		hasEventListener: function ( type, listener ) {

			if ( this._listeners === undefined ) return false;

			var listeners = this._listeners;

			return listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1;

		},

		removeEventListener: function ( type, listener ) {

			if ( this._listeners === undefined ) return;

			var listeners = this._listeners;
			var listenerArray = listeners[ type ];

			if ( listenerArray !== undefined ) {

				var index = listenerArray.indexOf( listener );

				if ( index !== - 1 ) {

					listenerArray.splice( index, 1 );

				}

			}

		},

		dispatchEvent: function ( event ) {

			if ( this._listeners === undefined ) return;

			var listeners = this._listeners;
			var listenerArray = listeners[ event.type ];

			if ( listenerArray !== undefined ) {

				event.target = this;

				var array = listenerArray.slice( 0 );

				for ( var i = 0, l = array.length; i < l; i ++ ) {

					array[ i ].call( this, event );

				}

			}

		}

	} );

	var FrontSide = 0;


	var FlatShading = 1;

	var NoColors = 0;



	var NormalBlending = 1;




	var AddEquation = 100;








	var SrcAlphaFactor = 204;
	var OneMinusSrcAlphaFactor = 205;








	var LessEqualDepth = 3;




	var MultiplyOperation = 0;







	var UVMapping = 300;
	var CubeReflectionMapping = 301;






	var RepeatWrapping = 1000;
	var ClampToEdgeWrapping = 1001;
	var MirroredRepeatWrapping = 1002;



	var LinearFilter = 1006;

	var LinearMipMapLinearFilter = 1008;
	var UnsignedByteType = 1009;













	var RGBAFormat = 1023;


























	var LinearEncoding = 3000;







	var BasicDepthPacking = 3200;

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 */

	var materialId = 0;

	function Material() {

		Object.defineProperty( this, 'id', { value: materialId ++ } );

		this.uuid = _Math.generateUUID();

		this.name = '';
		this.type = 'Material';

		this.fog = true;
		this.lights = true;

		this.blending = NormalBlending;
		this.side = FrontSide;
		this.flatShading = false;
		this.vertexColors = NoColors; // THREE.NoColors, THREE.VertexColors, THREE.FaceColors

		this.opacity = 1;
		this.transparent = false;

		this.blendSrc = SrcAlphaFactor;
		this.blendDst = OneMinusSrcAlphaFactor;
		this.blendEquation = AddEquation;
		this.blendSrcAlpha = null;
		this.blendDstAlpha = null;
		this.blendEquationAlpha = null;

		this.depthFunc = LessEqualDepth;
		this.depthTest = true;
		this.depthWrite = true;

		this.clippingPlanes = null;
		this.clipIntersection = false;
		this.clipShadows = false;

		this.colorWrite = true;

		this.precision = null; // override the renderer's default precision for this material

		this.polygonOffset = false;
		this.polygonOffsetFactor = 0;
		this.polygonOffsetUnits = 0;

		this.dithering = false;

		this.alphaTest = 0;
		this.premultipliedAlpha = false;

		this.overdraw = 0; // Overdrawn pixels (typically between 0 and 1) for fixing antialiasing gaps in CanvasRenderer

		this.visible = true;

		this.userData = {};

		this.needsUpdate = true;

	}

	Object.assign( Material.prototype, EventDispatcher.prototype, {

		isMaterial: true,

		onBeforeCompile: function () {},

		setValues: function ( values ) {

			if ( values === undefined ) return;

			for ( var key in values ) {

				var newValue = values[ key ];

				if ( newValue === undefined ) {

					console.warn( "THREE.Material: '" + key + "' parameter is undefined." );
					continue;

				}

				// for backward compatability if shading is set in the constructor
				if ( key === 'shading' ) {

					console.warn( 'THREE.' + this.type + ': .shading has been removed. Use the boolean .flatShading instead.' );
					this.flatShading = ( newValue === FlatShading ) ? true : false;
					continue;

				}

				var currentValue = this[ key ];

				if ( currentValue === undefined ) {

					console.warn( "THREE." + this.type + ": '" + key + "' is not a property of this material." );
					continue;

				}

				if ( currentValue && currentValue.isColor ) {

					currentValue.set( newValue );

				} else if ( ( currentValue && currentValue.isVector3 ) && ( newValue && newValue.isVector3 ) ) {

					currentValue.copy( newValue );

				} else if ( key === 'overdraw' ) {

					// ensure overdraw is backwards-compatible with legacy boolean type
					this[ key ] = Number( newValue );

				} else {

					this[ key ] = newValue;

				}

			}

		},

		toJSON: function ( meta ) {

			var isRoot = ( meta === undefined || typeof meta === 'string' );

			if ( isRoot ) {

				meta = {
					textures: {},
					images: {}
				};

			}

			var data = {
				metadata: {
					version: 4.5,
					type: 'Material',
					generator: 'Material.toJSON'
				}
			};

			// standard Material serialization
			data.uuid = this.uuid;
			data.type = this.type;

			if ( this.name !== '' ) data.name = this.name;

			if ( this.color && this.color.isColor ) data.color = this.color.getHex();

			if ( this.roughness !== undefined ) data.roughness = this.roughness;
			if ( this.metalness !== undefined ) data.metalness = this.metalness;

			if ( this.emissive && this.emissive.isColor ) data.emissive = this.emissive.getHex();
			if ( this.emissiveIntensity !== 1 ) data.emissiveIntensity = this.emissiveIntensity;

			if ( this.specular && this.specular.isColor ) data.specular = this.specular.getHex();
			if ( this.shininess !== undefined ) data.shininess = this.shininess;
			if ( this.clearCoat !== undefined ) data.clearCoat = this.clearCoat;
			if ( this.clearCoatRoughness !== undefined ) data.clearCoatRoughness = this.clearCoatRoughness;

			if ( this.map && this.map.isTexture ) data.map = this.map.toJSON( meta ).uuid;
			if ( this.alphaMap && this.alphaMap.isTexture ) data.alphaMap = this.alphaMap.toJSON( meta ).uuid;
			if ( this.lightMap && this.lightMap.isTexture ) data.lightMap = this.lightMap.toJSON( meta ).uuid;
			if ( this.bumpMap && this.bumpMap.isTexture ) {

				data.bumpMap = this.bumpMap.toJSON( meta ).uuid;
				data.bumpScale = this.bumpScale;

			}
			if ( this.normalMap && this.normalMap.isTexture ) {

				data.normalMap = this.normalMap.toJSON( meta ).uuid;
				data.normalScale = this.normalScale.toArray();

			}
			if ( this.displacementMap && this.displacementMap.isTexture ) {

				data.displacementMap = this.displacementMap.toJSON( meta ).uuid;
				data.displacementScale = this.displacementScale;
				data.displacementBias = this.displacementBias;

			}
			if ( this.roughnessMap && this.roughnessMap.isTexture ) data.roughnessMap = this.roughnessMap.toJSON( meta ).uuid;
			if ( this.metalnessMap && this.metalnessMap.isTexture ) data.metalnessMap = this.metalnessMap.toJSON( meta ).uuid;

			if ( this.emissiveMap && this.emissiveMap.isTexture ) data.emissiveMap = this.emissiveMap.toJSON( meta ).uuid;
			if ( this.specularMap && this.specularMap.isTexture ) data.specularMap = this.specularMap.toJSON( meta ).uuid;

			if ( this.envMap && this.envMap.isTexture ) {

				data.envMap = this.envMap.toJSON( meta ).uuid;
				data.reflectivity = this.reflectivity; // Scale behind envMap

			}

			if ( this.gradientMap && this.gradientMap.isTexture ) {

				data.gradientMap = this.gradientMap.toJSON( meta ).uuid;

			}

			if ( this.size !== undefined ) data.size = this.size;
			if ( this.sizeAttenuation !== undefined ) data.sizeAttenuation = this.sizeAttenuation;

			if ( this.blending !== NormalBlending ) data.blending = this.blending;
			if ( this.flatShading === true ) data.flatShading = this.flatShading;
			if ( this.side !== FrontSide ) data.side = this.side;
			if ( this.vertexColors !== NoColors ) data.vertexColors = this.vertexColors;

			if ( this.opacity < 1 ) data.opacity = this.opacity;
			if ( this.transparent === true ) data.transparent = this.transparent;

			data.depthFunc = this.depthFunc;
			data.depthTest = this.depthTest;
			data.depthWrite = this.depthWrite;

			// rotation (SpriteMaterial)
			if ( this.rotation !== 0 ) data.rotation = this.rotation;

			if ( this.linewidth !== 1 ) data.linewidth = this.linewidth;
			if ( this.dashSize !== undefined ) data.dashSize = this.dashSize;
			if ( this.gapSize !== undefined ) data.gapSize = this.gapSize;
			if ( this.scale !== undefined ) data.scale = this.scale;

			if ( this.dithering === true ) data.dithering = true;

			if ( this.alphaTest > 0 ) data.alphaTest = this.alphaTest;
			if ( this.premultipliedAlpha === true ) data.premultipliedAlpha = this.premultipliedAlpha;

			if ( this.wireframe === true ) data.wireframe = this.wireframe;
			if ( this.wireframeLinewidth > 1 ) data.wireframeLinewidth = this.wireframeLinewidth;
			if ( this.wireframeLinecap !== 'round' ) data.wireframeLinecap = this.wireframeLinecap;
			if ( this.wireframeLinejoin !== 'round' ) data.wireframeLinejoin = this.wireframeLinejoin;

			if ( this.morphTargets === true ) data.morphTargets = true;
			if ( this.skinning === true ) data.skinning = true;

			if ( this.visible === false ) data.visible = false;
			if ( JSON.stringify( this.userData ) !== '{}' ) data.userData = this.userData;

			// TODO: Copied from Object3D.toJSON

			function extractFromCache( cache ) {

				var values = [];

				for ( var key in cache ) {

					var data = cache[ key ];
					delete data.metadata;
					values.push( data );

				}

				return values;

			}

			if ( isRoot ) {

				var textures = extractFromCache( meta.textures );
				var images = extractFromCache( meta.images );

				if ( textures.length > 0 ) data.textures = textures;
				if ( images.length > 0 ) data.images = images;

			}

			return data;

		},

		clone: function () {

			return new this.constructor().copy( this );

		},

		copy: function ( source ) {

			this.name = source.name;

			this.fog = source.fog;
			this.lights = source.lights;

			this.blending = source.blending;
			this.side = source.side;
			this.flatShading = source.flatShading;
			this.vertexColors = source.vertexColors;

			this.opacity = source.opacity;
			this.transparent = source.transparent;

			this.blendSrc = source.blendSrc;
			this.blendDst = source.blendDst;
			this.blendEquation = source.blendEquation;
			this.blendSrcAlpha = source.blendSrcAlpha;
			this.blendDstAlpha = source.blendDstAlpha;
			this.blendEquationAlpha = source.blendEquationAlpha;

			this.depthFunc = source.depthFunc;
			this.depthTest = source.depthTest;
			this.depthWrite = source.depthWrite;

			this.colorWrite = source.colorWrite;

			this.precision = source.precision;

			this.polygonOffset = source.polygonOffset;
			this.polygonOffsetFactor = source.polygonOffsetFactor;
			this.polygonOffsetUnits = source.polygonOffsetUnits;

			this.dithering = source.dithering;

			this.alphaTest = source.alphaTest;
			this.premultipliedAlpha = source.premultipliedAlpha;

			this.overdraw = source.overdraw;

			this.visible = source.visible;
			this.userData = JSON.parse( JSON.stringify( source.userData ) );

			this.clipShadows = source.clipShadows;
			this.clipIntersection = source.clipIntersection;

			var srcPlanes = source.clippingPlanes,
				dstPlanes = null;

			if ( srcPlanes !== null ) {

				var n = srcPlanes.length;
				dstPlanes = new Array( n );

				for ( var i = 0; i !== n; ++ i )
					dstPlanes[ i ] = srcPlanes[ i ].clone();

			}

			this.clippingPlanes = dstPlanes;

			return this;

		},

		dispose: function () {

			this.dispatchEvent( { type: 'dispose' } );

		}

	} );

	/**
	 * @author mrdoob / http://mrdoob.com/
	 *
	 * parameters = {
	 *  color: <THREE.Color>,
	 *  opacity: <float>
	 * }
	 */

	function ShadowMaterial( parameters ) {

		Material.call( this );

		this.type = 'ShadowMaterial';

		this.color = new Color( 0x000000 );
		this.opacity = 1.0;

		this.lights = true;
		this.transparent = true;

		this.setValues( parameters );

	}

	ShadowMaterial.prototype = Object.create( Material.prototype );
	ShadowMaterial.prototype.constructor = ShadowMaterial;

	ShadowMaterial.prototype.isShadowMaterial = true;

	/**
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  opacity: <float>,
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *	uvOffset: new THREE.Vector2(),
	 *	uvScale: new THREE.Vector2()
	 * }
	 */

	function SpriteMaterial( parameters ) {

		Material.call( this );

		this.type = 'SpriteMaterial';

		this.color = new Color( 0xffffff );
		this.map = null;

		this.rotation = 0;

		this.fog = false;
		this.lights = false;

		this.setValues( parameters );

	}

	SpriteMaterial.prototype = Object.create( Material.prototype );
	SpriteMaterial.prototype.constructor = SpriteMaterial;
	SpriteMaterial.prototype.isSpriteMaterial = true;

	SpriteMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.color.copy( source.color );
		this.map = source.map;

		this.rotation = source.rotation;

		return this;

	};

	/**
	 * Uniform Utilities
	 */

	var UniformsUtils$1 = {

		merge: function ( uniforms ) {

			var merged = {};

			for ( var u = 0; u < uniforms.length; u ++ ) {

				var tmp = this.clone( uniforms[ u ] );

				for ( var p in tmp ) {

					merged[ p ] = tmp[ p ];

				}

			}

			return merged;

		},

		clone: function ( uniforms_src ) {

			var uniforms_dst = {};

			for ( var u in uniforms_src ) {

				uniforms_dst[ u ] = {};

				for ( var p in uniforms_src[ u ] ) {

					var parameter_src = uniforms_src[ u ][ p ];

					if ( parameter_src && ( parameter_src.isColor ||
						parameter_src.isMatrix3 || parameter_src.isMatrix4 ||
						parameter_src.isVector2 || parameter_src.isVector3 || parameter_src.isVector4 ||
						parameter_src.isTexture ) ) {

						uniforms_dst[ u ][ p ] = parameter_src.clone();

					} else if ( Array.isArray( parameter_src ) ) {

						uniforms_dst[ u ][ p ] = parameter_src.slice();

					} else {

						uniforms_dst[ u ][ p ] = parameter_src;

					}

				}

			}

			return uniforms_dst;

		}

	};

	/**
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  defines: { "label" : "value" },
	 *  uniforms: { "parameter1": { value: 1.0 }, "parameter2": { value2: 2 } },
	 *
	 *  fragmentShader: <string>,
	 *  vertexShader: <string>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>,
	 *
	 *  lights: <bool>,
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>,
	 *  morphNormals: <bool>
	 * }
	 */

	function ShaderMaterial( parameters ) {

		Material.call( this );

		this.type = 'ShaderMaterial';

		this.defines = {};
		this.uniforms = {};

		this.vertexShader = 'void main() {\n\tgl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}';
		this.fragmentShader = 'void main() {\n\tgl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}';

		this.linewidth = 1;

		this.wireframe = false;
		this.wireframeLinewidth = 1;

		this.fog = false; // set to use scene fog
		this.lights = false; // set to use scene lights
		this.clipping = false; // set to use user-defined clipping planes

		this.skinning = false; // set to use skinning attribute streams
		this.morphTargets = false; // set to use morph targets
		this.morphNormals = false; // set to use morph normals

		this.extensions = {
			derivatives: false, // set to use derivatives
			fragDepth: false, // set to use fragment depth values
			drawBuffers: false, // set to use draw buffers
			shaderTextureLOD: false // set to use shader texture LOD
		};

		// When rendered geometry doesn't include these attributes but the material does,
		// use these default values in WebGL. This avoids errors when buffer data is missing.
		this.defaultAttributeValues = {
			'color': [ 1, 1, 1 ],
			'uv': [ 0, 0 ],
			'uv2': [ 0, 0 ]
		};

		this.index0AttributeName = undefined;

		if ( parameters !== undefined ) {

			if ( parameters.attributes !== undefined ) {

				console.error( 'THREE.ShaderMaterial: attributes should now be defined in THREE.BufferGeometry instead.' );

			}

			this.setValues( parameters );

		}

	}

	ShaderMaterial.prototype = Object.create( Material.prototype );
	ShaderMaterial.prototype.constructor = ShaderMaterial;

	ShaderMaterial.prototype.isShaderMaterial = true;

	ShaderMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.fragmentShader = source.fragmentShader;
		this.vertexShader = source.vertexShader;

		this.uniforms = UniformsUtils$1.clone( source.uniforms );

		this.defines = source.defines;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;

		this.lights = source.lights;
		this.clipping = source.clipping;

		this.skinning = source.skinning;

		this.morphTargets = source.morphTargets;
		this.morphNormals = source.morphNormals;

		this.extensions = source.extensions;

		return this;

	};

	ShaderMaterial.prototype.toJSON = function ( meta ) {

		var data = Material.prototype.toJSON.call( this, meta );

		data.uniforms = this.uniforms;
		data.vertexShader = this.vertexShader;
		data.fragmentShader = this.fragmentShader;

		return data;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 */

	function RawShaderMaterial( parameters ) {

		ShaderMaterial.call( this, parameters );

		this.type = 'RawShaderMaterial';

	}

	RawShaderMaterial.prototype = Object.create( ShaderMaterial.prototype );
	RawShaderMaterial.prototype.constructor = RawShaderMaterial;

	RawShaderMaterial.prototype.isRawShaderMaterial = true;

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  opacity: <float>,
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  size: <float>,
	 *  sizeAttenuation: <bool>
	 * }
	 */

	function PointsMaterial( parameters ) {

		Material.call( this );

		this.type = 'PointsMaterial';

		this.color = new Color( 0xffffff );

		this.map = null;

		this.size = 1;
		this.sizeAttenuation = true;

		this.lights = false;

		this.setValues( parameters );

	}

	PointsMaterial.prototype = Object.create( Material.prototype );
	PointsMaterial.prototype.constructor = PointsMaterial;

	PointsMaterial.prototype.isPointsMaterial = true;

	PointsMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.color.copy( source.color );

		this.map = source.map;

		this.size = source.size;
		this.sizeAttenuation = source.sizeAttenuation;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author philogb / http://blog.thejit.org/
	 * @author egraether / http://egraether.com/
	 * @author zz85 / http://www.lab4games.net/zz85/blog
	 */

	function Vector2( x, y ) {

		this.x = x || 0;
		this.y = y || 0;

	}

	Object.defineProperties( Vector2.prototype, {

		"width": {

			get: function () {

				return this.x;

			},

			set: function ( value ) {

				this.x = value;

			}

		},

		"height": {

			get: function () {

				return this.y;

			},

			set: function ( value ) {

				this.y = value;

			}

		}

	} );

	Object.assign( Vector2.prototype, {

		isVector2: true,

		set: function ( x, y ) {

			this.x = x;
			this.y = y;

			return this;

		},

		setScalar: function ( scalar ) {

			this.x = scalar;
			this.y = scalar;

			return this;

		},

		setX: function ( x ) {

			this.x = x;

			return this;

		},

		setY: function ( y ) {

			this.y = y;

			return this;

		},

		setComponent: function ( index, value ) {

			switch ( index ) {

				case 0: this.x = value; break;
				case 1: this.y = value; break;
				default: throw new Error( 'index is out of range: ' + index );

			}

			return this;

		},

		getComponent: function ( index ) {

			switch ( index ) {

				case 0: return this.x;
				case 1: return this.y;
				default: throw new Error( 'index is out of range: ' + index );

			}

		},

		clone: function () {

			return new this.constructor( this.x, this.y );

		},

		copy: function ( v ) {

			this.x = v.x;
			this.y = v.y;

			return this;

		},

		add: function ( v, w ) {

			if ( w !== undefined ) {

				console.warn( 'THREE.Vector2: .add() now only accepts one argument. Use .addVectors( a, b ) instead.' );
				return this.addVectors( v, w );

			}

			this.x += v.x;
			this.y += v.y;

			return this;

		},

		addScalar: function ( s ) {

			this.x += s;
			this.y += s;

			return this;

		},

		addVectors: function ( a, b ) {

			this.x = a.x + b.x;
			this.y = a.y + b.y;

			return this;

		},

		addScaledVector: function ( v, s ) {

			this.x += v.x * s;
			this.y += v.y * s;

			return this;

		},

		sub: function ( v, w ) {

			if ( w !== undefined ) {

				console.warn( 'THREE.Vector2: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.' );
				return this.subVectors( v, w );

			}

			this.x -= v.x;
			this.y -= v.y;

			return this;

		},

		subScalar: function ( s ) {

			this.x -= s;
			this.y -= s;

			return this;

		},

		subVectors: function ( a, b ) {

			this.x = a.x - b.x;
			this.y = a.y - b.y;

			return this;

		},

		multiply: function ( v ) {

			this.x *= v.x;
			this.y *= v.y;

			return this;

		},

		multiplyScalar: function ( scalar ) {

			this.x *= scalar;
			this.y *= scalar;

			return this;

		},

		divide: function ( v ) {

			this.x /= v.x;
			this.y /= v.y;

			return this;

		},

		divideScalar: function ( scalar ) {

			return this.multiplyScalar( 1 / scalar );

		},

		applyMatrix3: function ( m ) {

			var x = this.x, y = this.y;
			var e = m.elements;

			this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ];
			this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ];

			return this;

		},

		min: function ( v ) {

			this.x = Math.min( this.x, v.x );
			this.y = Math.min( this.y, v.y );

			return this;

		},

		max: function ( v ) {

			this.x = Math.max( this.x, v.x );
			this.y = Math.max( this.y, v.y );

			return this;

		},

		clamp: function ( min, max ) {

			// assumes min < max, componentwise

			this.x = Math.max( min.x, Math.min( max.x, this.x ) );
			this.y = Math.max( min.y, Math.min( max.y, this.y ) );

			return this;

		},

		clampScalar: function () {

			var min = new Vector2();
			var max = new Vector2();

			return function clampScalar( minVal, maxVal ) {

				min.set( minVal, minVal );
				max.set( maxVal, maxVal );

				return this.clamp( min, max );

			};

		}(),

		clampLength: function ( min, max ) {

			var length = this.length();

			return this.divideScalar( length || 1 ).multiplyScalar( Math.max( min, Math.min( max, length ) ) );

		},

		floor: function () {

			this.x = Math.floor( this.x );
			this.y = Math.floor( this.y );

			return this;

		},

		ceil: function () {

			this.x = Math.ceil( this.x );
			this.y = Math.ceil( this.y );

			return this;

		},

		round: function () {

			this.x = Math.round( this.x );
			this.y = Math.round( this.y );

			return this;

		},

		roundToZero: function () {

			this.x = ( this.x < 0 ) ? Math.ceil( this.x ) : Math.floor( this.x );
			this.y = ( this.y < 0 ) ? Math.ceil( this.y ) : Math.floor( this.y );

			return this;

		},

		negate: function () {

			this.x = - this.x;
			this.y = - this.y;

			return this;

		},

		dot: function ( v ) {

			return this.x * v.x + this.y * v.y;

		},

		lengthSq: function () {

			return this.x * this.x + this.y * this.y;

		},

		length: function () {

			return Math.sqrt( this.x * this.x + this.y * this.y );

		},

		manhattanLength: function () {

			return Math.abs( this.x ) + Math.abs( this.y );

		},

		normalize: function () {

			return this.divideScalar( this.length() || 1 );

		},

		angle: function () {

			// computes the angle in radians with respect to the positive x-axis

			var angle = Math.atan2( this.y, this.x );

			if ( angle < 0 ) angle += 2 * Math.PI;

			return angle;

		},

		distanceTo: function ( v ) {

			return Math.sqrt( this.distanceToSquared( v ) );

		},

		distanceToSquared: function ( v ) {

			var dx = this.x - v.x, dy = this.y - v.y;
			return dx * dx + dy * dy;

		},

		manhattanDistanceTo: function ( v ) {

			return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y );

		},

		setLength: function ( length ) {

			return this.normalize().multiplyScalar( length );

		},

		lerp: function ( v, alpha ) {

			this.x += ( v.x - this.x ) * alpha;
			this.y += ( v.y - this.y ) * alpha;

			return this;

		},

		lerpVectors: function ( v1, v2, alpha ) {

			return this.subVectors( v2, v1 ).multiplyScalar( alpha ).add( v1 );

		},

		equals: function ( v ) {

			return ( ( v.x === this.x ) && ( v.y === this.y ) );

		},

		fromArray: function ( array, offset ) {

			if ( offset === undefined ) offset = 0;

			this.x = array[ offset ];
			this.y = array[ offset + 1 ];

			return this;

		},

		toArray: function ( array, offset ) {

			if ( array === undefined ) array = [];
			if ( offset === undefined ) offset = 0;

			array[ offset ] = this.x;
			array[ offset + 1 ] = this.y;

			return array;

		},

		fromBufferAttribute: function ( attribute, index, offset ) {

			if ( offset !== undefined ) {

				console.warn( 'THREE.Vector2: offset has been removed from .fromBufferAttribute().' );

			}

			this.x = attribute.getX( index );
			this.y = attribute.getY( index );

			return this;

		},

		rotateAround: function ( center, angle ) {

			var c = Math.cos( angle ), s = Math.sin( angle );

			var x = this.x - center.x;
			var y = this.y - center.y;

			this.x = x * c - y * s + center.x;
			this.y = x * s + y * c + center.y;

			return this;

		}

	} );

	/**
	 * @author WestLangley / http://github.com/WestLangley
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  roughness: <float>,
	 *  metalness: <float>,
	 *  opacity: <float>,
	 *
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  lightMap: new THREE.Texture( <Image> ),
	 *  lightMapIntensity: <float>
	 *
	 *  aoMap: new THREE.Texture( <Image> ),
	 *  aoMapIntensity: <float>
	 *
	 *  emissive: <hex>,
	 *  emissiveIntensity: <float>
	 *  emissiveMap: new THREE.Texture( <Image> ),
	 *
	 *  bumpMap: new THREE.Texture( <Image> ),
	 *  bumpScale: <float>,
	 *
	 *  normalMap: new THREE.Texture( <Image> ),
	 *  normalScale: <Vector2>,
	 *
	 *  displacementMap: new THREE.Texture( <Image> ),
	 *  displacementScale: <float>,
	 *  displacementBias: <float>,
	 *
	 *  roughnessMap: new THREE.Texture( <Image> ),
	 *
	 *  metalnessMap: new THREE.Texture( <Image> ),
	 *
	 *  alphaMap: new THREE.Texture( <Image> ),
	 *
	 *  envMap: new THREE.CubeTexture( [posx, negx, posy, negy, posz, negz] ),
	 *  envMapIntensity: <float>
	 *
	 *  refractionRatio: <float>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>,
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>,
	 *  morphNormals: <bool>
	 * }
	 */

	function MeshStandardMaterial( parameters ) {

		Material.call( this );

		this.defines = { 'STANDARD': '' };

		this.type = 'MeshStandardMaterial';

		this.color = new Color( 0xffffff ); // diffuse
		this.roughness = 0.5;
		this.metalness = 0.5;

		this.map = null;

		this.lightMap = null;
		this.lightMapIntensity = 1.0;

		this.aoMap = null;
		this.aoMapIntensity = 1.0;

		this.emissive = new Color( 0x000000 );
		this.emissiveIntensity = 1.0;
		this.emissiveMap = null;

		this.bumpMap = null;
		this.bumpScale = 1;

		this.normalMap = null;
		this.normalScale = new Vector2( 1, 1 );

		this.displacementMap = null;
		this.displacementScale = 1;
		this.displacementBias = 0;

		this.roughnessMap = null;

		this.metalnessMap = null;

		this.alphaMap = null;

		this.envMap = null;
		this.envMapIntensity = 1.0;

		this.refractionRatio = 0.98;

		this.wireframe = false;
		this.wireframeLinewidth = 1;
		this.wireframeLinecap = 'round';
		this.wireframeLinejoin = 'round';

		this.skinning = false;
		this.morphTargets = false;
		this.morphNormals = false;

		this.setValues( parameters );

	}

	MeshStandardMaterial.prototype = Object.create( Material.prototype );
	MeshStandardMaterial.prototype.constructor = MeshStandardMaterial;

	MeshStandardMaterial.prototype.isMeshStandardMaterial = true;

	MeshStandardMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.defines = { 'STANDARD': '' };

		this.color.copy( source.color );
		this.roughness = source.roughness;
		this.metalness = source.metalness;

		this.map = source.map;

		this.lightMap = source.lightMap;
		this.lightMapIntensity = source.lightMapIntensity;

		this.aoMap = source.aoMap;
		this.aoMapIntensity = source.aoMapIntensity;

		this.emissive.copy( source.emissive );
		this.emissiveMap = source.emissiveMap;
		this.emissiveIntensity = source.emissiveIntensity;

		this.bumpMap = source.bumpMap;
		this.bumpScale = source.bumpScale;

		this.normalMap = source.normalMap;
		this.normalScale.copy( source.normalScale );

		this.displacementMap = source.displacementMap;
		this.displacementScale = source.displacementScale;
		this.displacementBias = source.displacementBias;

		this.roughnessMap = source.roughnessMap;

		this.metalnessMap = source.metalnessMap;

		this.alphaMap = source.alphaMap;

		this.envMap = source.envMap;
		this.envMapIntensity = source.envMapIntensity;

		this.refractionRatio = source.refractionRatio;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;
		this.wireframeLinecap = source.wireframeLinecap;
		this.wireframeLinejoin = source.wireframeLinejoin;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;
		this.morphNormals = source.morphNormals;

		return this;

	};

	/**
	 * @author WestLangley / http://github.com/WestLangley
	 *
	 * parameters = {
	 *  reflectivity: <float>
	 * }
	 */

	function MeshPhysicalMaterial( parameters ) {

		MeshStandardMaterial.call( this );

		this.defines = { 'PHYSICAL': '' };

		this.type = 'MeshPhysicalMaterial';

		this.reflectivity = 0.5; // maps to F0 = 0.04

		this.clearCoat = 0.0;
		this.clearCoatRoughness = 0.0;

		this.setValues( parameters );

	}

	MeshPhysicalMaterial.prototype = Object.create( MeshStandardMaterial.prototype );
	MeshPhysicalMaterial.prototype.constructor = MeshPhysicalMaterial;

	MeshPhysicalMaterial.prototype.isMeshPhysicalMaterial = true;

	MeshPhysicalMaterial.prototype.copy = function ( source ) {

		MeshStandardMaterial.prototype.copy.call( this, source );

		this.defines = { 'PHYSICAL': '' };

		this.reflectivity = source.reflectivity;

		this.clearCoat = source.clearCoat;
		this.clearCoatRoughness = source.clearCoatRoughness;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  specular: <hex>,
	 *  shininess: <float>,
	 *  opacity: <float>,
	 *
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  lightMap: new THREE.Texture( <Image> ),
	 *  lightMapIntensity: <float>
	 *
	 *  aoMap: new THREE.Texture( <Image> ),
	 *  aoMapIntensity: <float>
	 *
	 *  emissive: <hex>,
	 *  emissiveIntensity: <float>
	 *  emissiveMap: new THREE.Texture( <Image> ),
	 *
	 *  bumpMap: new THREE.Texture( <Image> ),
	 *  bumpScale: <float>,
	 *
	 *  normalMap: new THREE.Texture( <Image> ),
	 *  normalScale: <Vector2>,
	 *
	 *  displacementMap: new THREE.Texture( <Image> ),
	 *  displacementScale: <float>,
	 *  displacementBias: <float>,
	 *
	 *  specularMap: new THREE.Texture( <Image> ),
	 *
	 *  alphaMap: new THREE.Texture( <Image> ),
	 *
	 *  envMap: new THREE.TextureCube( [posx, negx, posy, negy, posz, negz] ),
	 *  combine: THREE.Multiply,
	 *  reflectivity: <float>,
	 *  refractionRatio: <float>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>,
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>,
	 *  morphNormals: <bool>
	 * }
	 */

	function MeshPhongMaterial( parameters ) {

		Material.call( this );

		this.type = 'MeshPhongMaterial';

		this.color = new Color( 0xffffff ); // diffuse
		this.specular = new Color( 0x111111 );
		this.shininess = 30;

		this.map = null;

		this.lightMap = null;
		this.lightMapIntensity = 1.0;

		this.aoMap = null;
		this.aoMapIntensity = 1.0;

		this.emissive = new Color( 0x000000 );
		this.emissiveIntensity = 1.0;
		this.emissiveMap = null;

		this.bumpMap = null;
		this.bumpScale = 1;

		this.normalMap = null;
		this.normalScale = new Vector2( 1, 1 );

		this.displacementMap = null;
		this.displacementScale = 1;
		this.displacementBias = 0;

		this.specularMap = null;

		this.alphaMap = null;

		this.envMap = null;
		this.combine = MultiplyOperation;
		this.reflectivity = 1;
		this.refractionRatio = 0.98;

		this.wireframe = false;
		this.wireframeLinewidth = 1;
		this.wireframeLinecap = 'round';
		this.wireframeLinejoin = 'round';

		this.skinning = false;
		this.morphTargets = false;
		this.morphNormals = false;

		this.setValues( parameters );

	}

	MeshPhongMaterial.prototype = Object.create( Material.prototype );
	MeshPhongMaterial.prototype.constructor = MeshPhongMaterial;

	MeshPhongMaterial.prototype.isMeshPhongMaterial = true;

	MeshPhongMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.color.copy( source.color );
		this.specular.copy( source.specular );
		this.shininess = source.shininess;

		this.map = source.map;

		this.lightMap = source.lightMap;
		this.lightMapIntensity = source.lightMapIntensity;

		this.aoMap = source.aoMap;
		this.aoMapIntensity = source.aoMapIntensity;

		this.emissive.copy( source.emissive );
		this.emissiveMap = source.emissiveMap;
		this.emissiveIntensity = source.emissiveIntensity;

		this.bumpMap = source.bumpMap;
		this.bumpScale = source.bumpScale;

		this.normalMap = source.normalMap;
		this.normalScale.copy( source.normalScale );

		this.displacementMap = source.displacementMap;
		this.displacementScale = source.displacementScale;
		this.displacementBias = source.displacementBias;

		this.specularMap = source.specularMap;

		this.alphaMap = source.alphaMap;

		this.envMap = source.envMap;
		this.combine = source.combine;
		this.reflectivity = source.reflectivity;
		this.refractionRatio = source.refractionRatio;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;
		this.wireframeLinecap = source.wireframeLinecap;
		this.wireframeLinejoin = source.wireframeLinejoin;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;
		this.morphNormals = source.morphNormals;

		return this;

	};

	/**
	 * @author takahirox / http://github.com/takahirox
	 *
	 * parameters = {
	 *  gradientMap: new THREE.Texture( <Image> )
	 * }
	 */

	function MeshToonMaterial( parameters ) {

		MeshPhongMaterial.call( this );

		this.defines = { 'TOON': '' };

		this.type = 'MeshToonMaterial';

		this.gradientMap = null;

		this.setValues( parameters );

	}

	MeshToonMaterial.prototype = Object.create( MeshPhongMaterial.prototype );
	MeshToonMaterial.prototype.constructor = MeshToonMaterial;

	MeshToonMaterial.prototype.isMeshToonMaterial = true;

	MeshToonMaterial.prototype.copy = function ( source ) {

		MeshPhongMaterial.prototype.copy.call( this, source );

		this.gradientMap = source.gradientMap;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author WestLangley / http://github.com/WestLangley
	 *
	 * parameters = {
	 *  opacity: <float>,
	 *
	 *  bumpMap: new THREE.Texture( <Image> ),
	 *  bumpScale: <float>,
	 *
	 *  normalMap: new THREE.Texture( <Image> ),
	 *  normalScale: <Vector2>,
	 *
	 *  displacementMap: new THREE.Texture( <Image> ),
	 *  displacementScale: <float>,
	 *  displacementBias: <float>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>,
	 *  morphNormals: <bool>
	 * }
	 */

	function MeshNormalMaterial( parameters ) {

		Material.call( this );

		this.type = 'MeshNormalMaterial';

		this.bumpMap = null;
		this.bumpScale = 1;

		this.normalMap = null;
		this.normalScale = new Vector2( 1, 1 );

		this.displacementMap = null;
		this.displacementScale = 1;
		this.displacementBias = 0;

		this.wireframe = false;
		this.wireframeLinewidth = 1;

		this.fog = false;
		this.lights = false;

		this.skinning = false;
		this.morphTargets = false;
		this.morphNormals = false;

		this.setValues( parameters );

	}

	MeshNormalMaterial.prototype = Object.create( Material.prototype );
	MeshNormalMaterial.prototype.constructor = MeshNormalMaterial;

	MeshNormalMaterial.prototype.isMeshNormalMaterial = true;

	MeshNormalMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.bumpMap = source.bumpMap;
		this.bumpScale = source.bumpScale;

		this.normalMap = source.normalMap;
		this.normalScale.copy( source.normalScale );

		this.displacementMap = source.displacementMap;
		this.displacementScale = source.displacementScale;
		this.displacementBias = source.displacementBias;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;
		this.morphNormals = source.morphNormals;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  opacity: <float>,
	 *
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  lightMap: new THREE.Texture( <Image> ),
	 *  lightMapIntensity: <float>
	 *
	 *  aoMap: new THREE.Texture( <Image> ),
	 *  aoMapIntensity: <float>
	 *
	 *  emissive: <hex>,
	 *  emissiveIntensity: <float>
	 *  emissiveMap: new THREE.Texture( <Image> ),
	 *
	 *  specularMap: new THREE.Texture( <Image> ),
	 *
	 *  alphaMap: new THREE.Texture( <Image> ),
	 *
	 *  envMap: new THREE.TextureCube( [posx, negx, posy, negy, posz, negz] ),
	 *  combine: THREE.Multiply,
	 *  reflectivity: <float>,
	 *  refractionRatio: <float>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>,
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>,
	 *  morphNormals: <bool>
	 * }
	 */

	function MeshLambertMaterial( parameters ) {

		Material.call( this );

		this.type = 'MeshLambertMaterial';

		this.color = new Color( 0xffffff ); // diffuse

		this.map = null;

		this.lightMap = null;
		this.lightMapIntensity = 1.0;

		this.aoMap = null;
		this.aoMapIntensity = 1.0;

		this.emissive = new Color( 0x000000 );
		this.emissiveIntensity = 1.0;
		this.emissiveMap = null;

		this.specularMap = null;

		this.alphaMap = null;

		this.envMap = null;
		this.combine = MultiplyOperation;
		this.reflectivity = 1;
		this.refractionRatio = 0.98;

		this.wireframe = false;
		this.wireframeLinewidth = 1;
		this.wireframeLinecap = 'round';
		this.wireframeLinejoin = 'round';

		this.skinning = false;
		this.morphTargets = false;
		this.morphNormals = false;

		this.setValues( parameters );

	}

	MeshLambertMaterial.prototype = Object.create( Material.prototype );
	MeshLambertMaterial.prototype.constructor = MeshLambertMaterial;

	MeshLambertMaterial.prototype.isMeshLambertMaterial = true;

	MeshLambertMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.color.copy( source.color );

		this.map = source.map;

		this.lightMap = source.lightMap;
		this.lightMapIntensity = source.lightMapIntensity;

		this.aoMap = source.aoMap;
		this.aoMapIntensity = source.aoMapIntensity;

		this.emissive.copy( source.emissive );
		this.emissiveMap = source.emissiveMap;
		this.emissiveIntensity = source.emissiveIntensity;

		this.specularMap = source.specularMap;

		this.alphaMap = source.alphaMap;

		this.envMap = source.envMap;
		this.combine = source.combine;
		this.reflectivity = source.reflectivity;
		this.refractionRatio = source.refractionRatio;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;
		this.wireframeLinecap = source.wireframeLinecap;
		this.wireframeLinejoin = source.wireframeLinejoin;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;
		this.morphNormals = source.morphNormals;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 * @author bhouston / https://clara.io
	 * @author WestLangley / http://github.com/WestLangley
	 *
	 * parameters = {
	 *
	 *  opacity: <float>,
	 *
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  alphaMap: new THREE.Texture( <Image> ),
	 *
	 *  displacementMap: new THREE.Texture( <Image> ),
	 *  displacementScale: <float>,
	 *  displacementBias: <float>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>
	 * }
	 */

	function MeshDepthMaterial( parameters ) {

		Material.call( this );

		this.type = 'MeshDepthMaterial';

		this.depthPacking = BasicDepthPacking;

		this.skinning = false;
		this.morphTargets = false;

		this.map = null;

		this.alphaMap = null;

		this.displacementMap = null;
		this.displacementScale = 1;
		this.displacementBias = 0;

		this.wireframe = false;
		this.wireframeLinewidth = 1;

		this.fog = false;
		this.lights = false;

		this.setValues( parameters );

	}

	MeshDepthMaterial.prototype = Object.create( Material.prototype );
	MeshDepthMaterial.prototype.constructor = MeshDepthMaterial;

	MeshDepthMaterial.prototype.isMeshDepthMaterial = true;

	MeshDepthMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.depthPacking = source.depthPacking;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;

		this.map = source.map;

		this.alphaMap = source.alphaMap;

		this.displacementMap = source.displacementMap;
		this.displacementScale = source.displacementScale;
		this.displacementBias = source.displacementBias;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author supereggbert / http://www.paulbrunt.co.uk/
	 * @author philogb / http://blog.thejit.org/
	 * @author jordi_ros / http://plattsoft.com
	 * @author D1plo1d / http://github.com/D1plo1d
	 * @author alteredq / http://alteredqualia.com/
	 * @author mikael emtinger / http://gomo.se/
	 * @author timknip / http://www.floorplanner.com/
	 * @author bhouston / http://clara.io
	 * @author WestLangley / http://github.com/WestLangley
	 */

	function Matrix4() {

		this.elements = [

			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1

		];

		if ( arguments.length > 0 ) {

			console.error( 'THREE.Matrix4: the constructor no longer reads arguments. use .set() instead.' );

		}

	}

	Object.assign( Matrix4.prototype, {

		isMatrix4: true,

		set: function ( n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44 ) {

			var te = this.elements;

			te[ 0 ] = n11; te[ 4 ] = n12; te[ 8 ] = n13; te[ 12 ] = n14;
			te[ 1 ] = n21; te[ 5 ] = n22; te[ 9 ] = n23; te[ 13 ] = n24;
			te[ 2 ] = n31; te[ 6 ] = n32; te[ 10 ] = n33; te[ 14 ] = n34;
			te[ 3 ] = n41; te[ 7 ] = n42; te[ 11 ] = n43; te[ 15 ] = n44;

			return this;

		},

		identity: function () {

			this.set(

				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1

			);

			return this;

		},

		clone: function () {

			return new Matrix4().fromArray( this.elements );

		},

		copy: function ( m ) {

			var te = this.elements;
			var me = m.elements;

			te[ 0 ] = me[ 0 ]; te[ 1 ] = me[ 1 ]; te[ 2 ] = me[ 2 ]; te[ 3 ] = me[ 3 ];
			te[ 4 ] = me[ 4 ]; te[ 5 ] = me[ 5 ]; te[ 6 ] = me[ 6 ]; te[ 7 ] = me[ 7 ];
			te[ 8 ] = me[ 8 ]; te[ 9 ] = me[ 9 ]; te[ 10 ] = me[ 10 ]; te[ 11 ] = me[ 11 ];
			te[ 12 ] = me[ 12 ]; te[ 13 ] = me[ 13 ]; te[ 14 ] = me[ 14 ]; te[ 15 ] = me[ 15 ];

			return this;

		},

		copyPosition: function ( m ) {

			var te = this.elements, me = m.elements;

			te[ 12 ] = me[ 12 ];
			te[ 13 ] = me[ 13 ];
			te[ 14 ] = me[ 14 ];

			return this;

		},

		extractBasis: function ( xAxis, yAxis, zAxis ) {

			xAxis.setFromMatrixColumn( this, 0 );
			yAxis.setFromMatrixColumn( this, 1 );
			zAxis.setFromMatrixColumn( this, 2 );

			return this;

		},

		makeBasis: function ( xAxis, yAxis, zAxis ) {

			this.set(
				xAxis.x, yAxis.x, zAxis.x, 0,
				xAxis.y, yAxis.y, zAxis.y, 0,
				xAxis.z, yAxis.z, zAxis.z, 0,
				0, 0, 0, 1
			);

			return this;

		},

		extractRotation: function () {

			var v1 = new Vector3();

			return function extractRotation( m ) {

				var te = this.elements;
				var me = m.elements;

				var scaleX = 1 / v1.setFromMatrixColumn( m, 0 ).length();
				var scaleY = 1 / v1.setFromMatrixColumn( m, 1 ).length();
				var scaleZ = 1 / v1.setFromMatrixColumn( m, 2 ).length();

				te[ 0 ] = me[ 0 ] * scaleX;
				te[ 1 ] = me[ 1 ] * scaleX;
				te[ 2 ] = me[ 2 ] * scaleX;

				te[ 4 ] = me[ 4 ] * scaleY;
				te[ 5 ] = me[ 5 ] * scaleY;
				te[ 6 ] = me[ 6 ] * scaleY;

				te[ 8 ] = me[ 8 ] * scaleZ;
				te[ 9 ] = me[ 9 ] * scaleZ;
				te[ 10 ] = me[ 10 ] * scaleZ;

				return this;

			};

		}(),

		makeRotationFromEuler: function ( euler ) {

			if ( ! ( euler && euler.isEuler ) ) {

				console.error( 'THREE.Matrix4: .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.' );

			}

			var te = this.elements;

			var x = euler.x, y = euler.y, z = euler.z;
			var a = Math.cos( x ), b = Math.sin( x );
			var c = Math.cos( y ), d = Math.sin( y );
			var e = Math.cos( z ), f = Math.sin( z );

			if ( euler.order === 'XYZ' ) {

				var ae = a * e, af = a * f, be = b * e, bf = b * f;

				te[ 0 ] = c * e;
				te[ 4 ] = - c * f;
				te[ 8 ] = d;

				te[ 1 ] = af + be * d;
				te[ 5 ] = ae - bf * d;
				te[ 9 ] = - b * c;

				te[ 2 ] = bf - ae * d;
				te[ 6 ] = be + af * d;
				te[ 10 ] = a * c;

			} else if ( euler.order === 'YXZ' ) {

				var ce = c * e, cf = c * f, de = d * e, df = d * f;

				te[ 0 ] = ce + df * b;
				te[ 4 ] = de * b - cf;
				te[ 8 ] = a * d;

				te[ 1 ] = a * f;
				te[ 5 ] = a * e;
				te[ 9 ] = - b;

				te[ 2 ] = cf * b - de;
				te[ 6 ] = df + ce * b;
				te[ 10 ] = a * c;

			} else if ( euler.order === 'ZXY' ) {

				var ce = c * e, cf = c * f, de = d * e, df = d * f;

				te[ 0 ] = ce - df * b;
				te[ 4 ] = - a * f;
				te[ 8 ] = de + cf * b;

				te[ 1 ] = cf + de * b;
				te[ 5 ] = a * e;
				te[ 9 ] = df - ce * b;

				te[ 2 ] = - a * d;
				te[ 6 ] = b;
				te[ 10 ] = a * c;

			} else if ( euler.order === 'ZYX' ) {

				var ae = a * e, af = a * f, be = b * e, bf = b * f;

				te[ 0 ] = c * e;
				te[ 4 ] = be * d - af;
				te[ 8 ] = ae * d + bf;

				te[ 1 ] = c * f;
				te[ 5 ] = bf * d + ae;
				te[ 9 ] = af * d - be;

				te[ 2 ] = - d;
				te[ 6 ] = b * c;
				te[ 10 ] = a * c;

			} else if ( euler.order === 'YZX' ) {

				var ac = a * c, ad = a * d, bc = b * c, bd = b * d;

				te[ 0 ] = c * e;
				te[ 4 ] = bd - ac * f;
				te[ 8 ] = bc * f + ad;

				te[ 1 ] = f;
				te[ 5 ] = a * e;
				te[ 9 ] = - b * e;

				te[ 2 ] = - d * e;
				te[ 6 ] = ad * f + bc;
				te[ 10 ] = ac - bd * f;

			} else if ( euler.order === 'XZY' ) {

				var ac = a * c, ad = a * d, bc = b * c, bd = b * d;

				te[ 0 ] = c * e;
				te[ 4 ] = - f;
				te[ 8 ] = d * e;

				te[ 1 ] = ac * f + bd;
				te[ 5 ] = a * e;
				te[ 9 ] = ad * f - bc;

				te[ 2 ] = bc * f - ad;
				te[ 6 ] = b * e;
				te[ 10 ] = bd * f + ac;

			}

			// last column
			te[ 3 ] = 0;
			te[ 7 ] = 0;
			te[ 11 ] = 0;

			// bottom row
			te[ 12 ] = 0;
			te[ 13 ] = 0;
			te[ 14 ] = 0;
			te[ 15 ] = 1;

			return this;

		},

		makeRotationFromQuaternion: function ( q ) {

			var te = this.elements;

			var x = q._x, y = q._y, z = q._z, w = q._w;
			var x2 = x + x, y2 = y + y, z2 = z + z;
			var xx = x * x2, xy = x * y2, xz = x * z2;
			var yy = y * y2, yz = y * z2, zz = z * z2;
			var wx = w * x2, wy = w * y2, wz = w * z2;

			te[ 0 ] = 1 - ( yy + zz );
			te[ 4 ] = xy - wz;
			te[ 8 ] = xz + wy;

			te[ 1 ] = xy + wz;
			te[ 5 ] = 1 - ( xx + zz );
			te[ 9 ] = yz - wx;

			te[ 2 ] = xz - wy;
			te[ 6 ] = yz + wx;
			te[ 10 ] = 1 - ( xx + yy );

			// last column
			te[ 3 ] = 0;
			te[ 7 ] = 0;
			te[ 11 ] = 0;

			// bottom row
			te[ 12 ] = 0;
			te[ 13 ] = 0;
			te[ 14 ] = 0;
			te[ 15 ] = 1;

			return this;

		},

		lookAt: function () {

			var x = new Vector3();
			var y = new Vector3();
			var z = new Vector3();

			return function lookAt( eye, target, up ) {

				var te = this.elements;

				z.subVectors( eye, target );

				if ( z.lengthSq() === 0 ) {

					// eye and target are in the same position

					z.z = 1;

				}

				z.normalize();
				x.crossVectors( up, z );

				if ( x.lengthSq() === 0 ) {

					// up and z are parallel

					if ( Math.abs( up.z ) === 1 ) {

						z.x += 0.0001;

					} else {

						z.z += 0.0001;

					}

					z.normalize();
					x.crossVectors( up, z );

				}

				x.normalize();
				y.crossVectors( z, x );

				te[ 0 ] = x.x; te[ 4 ] = y.x; te[ 8 ] = z.x;
				te[ 1 ] = x.y; te[ 5 ] = y.y; te[ 9 ] = z.y;
				te[ 2 ] = x.z; te[ 6 ] = y.z; te[ 10 ] = z.z;

				return this;

			};

		}(),

		multiply: function ( m, n ) {

			if ( n !== undefined ) {

				console.warn( 'THREE.Matrix4: .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead.' );
				return this.multiplyMatrices( m, n );

			}

			return this.multiplyMatrices( this, m );

		},

		premultiply: function ( m ) {

			return this.multiplyMatrices( m, this );

		},

		multiplyMatrices: function ( a, b ) {

			var ae = a.elements;
			var be = b.elements;
			var te = this.elements;

			var a11 = ae[ 0 ], a12 = ae[ 4 ], a13 = ae[ 8 ], a14 = ae[ 12 ];
			var a21 = ae[ 1 ], a22 = ae[ 5 ], a23 = ae[ 9 ], a24 = ae[ 13 ];
			var a31 = ae[ 2 ], a32 = ae[ 6 ], a33 = ae[ 10 ], a34 = ae[ 14 ];
			var a41 = ae[ 3 ], a42 = ae[ 7 ], a43 = ae[ 11 ], a44 = ae[ 15 ];

			var b11 = be[ 0 ], b12 = be[ 4 ], b13 = be[ 8 ], b14 = be[ 12 ];
			var b21 = be[ 1 ], b22 = be[ 5 ], b23 = be[ 9 ], b24 = be[ 13 ];
			var b31 = be[ 2 ], b32 = be[ 6 ], b33 = be[ 10 ], b34 = be[ 14 ];
			var b41 = be[ 3 ], b42 = be[ 7 ], b43 = be[ 11 ], b44 = be[ 15 ];

			te[ 0 ] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
			te[ 4 ] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
			te[ 8 ] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
			te[ 12 ] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

			te[ 1 ] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
			te[ 5 ] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
			te[ 9 ] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
			te[ 13 ] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

			te[ 2 ] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
			te[ 6 ] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
			te[ 10 ] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
			te[ 14 ] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

			te[ 3 ] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
			te[ 7 ] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
			te[ 11 ] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
			te[ 15 ] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

			return this;

		},

		multiplyScalar: function ( s ) {

			var te = this.elements;

			te[ 0 ] *= s; te[ 4 ] *= s; te[ 8 ] *= s; te[ 12 ] *= s;
			te[ 1 ] *= s; te[ 5 ] *= s; te[ 9 ] *= s; te[ 13 ] *= s;
			te[ 2 ] *= s; te[ 6 ] *= s; te[ 10 ] *= s; te[ 14 ] *= s;
			te[ 3 ] *= s; te[ 7 ] *= s; te[ 11 ] *= s; te[ 15 ] *= s;

			return this;

		},

		applyToBufferAttribute: function () {

			var v1 = new Vector3();

			return function applyToBufferAttribute( attribute ) {

				for ( var i = 0, l = attribute.count; i < l; i ++ ) {

					v1.x = attribute.getX( i );
					v1.y = attribute.getY( i );
					v1.z = attribute.getZ( i );

					v1.applyMatrix4( this );

					attribute.setXYZ( i, v1.x, v1.y, v1.z );

				}

				return attribute;

			};

		}(),

		determinant: function () {

			var te = this.elements;

			var n11 = te[ 0 ], n12 = te[ 4 ], n13 = te[ 8 ], n14 = te[ 12 ];
			var n21 = te[ 1 ], n22 = te[ 5 ], n23 = te[ 9 ], n24 = te[ 13 ];
			var n31 = te[ 2 ], n32 = te[ 6 ], n33 = te[ 10 ], n34 = te[ 14 ];
			var n41 = te[ 3 ], n42 = te[ 7 ], n43 = te[ 11 ], n44 = te[ 15 ];

			//TODO: make this more efficient
			//( based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm )

			return (
				n41 * (
					+ n14 * n23 * n32
					 - n13 * n24 * n32
					 - n14 * n22 * n33
					 + n12 * n24 * n33
					 + n13 * n22 * n34
					 - n12 * n23 * n34
				) +
				n42 * (
					+ n11 * n23 * n34
					 - n11 * n24 * n33
					 + n14 * n21 * n33
					 - n13 * n21 * n34
					 + n13 * n24 * n31
					 - n14 * n23 * n31
				) +
				n43 * (
					+ n11 * n24 * n32
					 - n11 * n22 * n34
					 - n14 * n21 * n32
					 + n12 * n21 * n34
					 + n14 * n22 * n31
					 - n12 * n24 * n31
				) +
				n44 * (
					- n13 * n22 * n31
					 - n11 * n23 * n32
					 + n11 * n22 * n33
					 + n13 * n21 * n32
					 - n12 * n21 * n33
					 + n12 * n23 * n31
				)

			);

		},

		transpose: function () {

			var te = this.elements;
			var tmp;

			tmp = te[ 1 ]; te[ 1 ] = te[ 4 ]; te[ 4 ] = tmp;
			tmp = te[ 2 ]; te[ 2 ] = te[ 8 ]; te[ 8 ] = tmp;
			tmp = te[ 6 ]; te[ 6 ] = te[ 9 ]; te[ 9 ] = tmp;

			tmp = te[ 3 ]; te[ 3 ] = te[ 12 ]; te[ 12 ] = tmp;
			tmp = te[ 7 ]; te[ 7 ] = te[ 13 ]; te[ 13 ] = tmp;
			tmp = te[ 11 ]; te[ 11 ] = te[ 14 ]; te[ 14 ] = tmp;

			return this;

		},

		setPosition: function ( v ) {

			var te = this.elements;

			te[ 12 ] = v.x;
			te[ 13 ] = v.y;
			te[ 14 ] = v.z;

			return this;

		},

		getInverse: function ( m, throwOnDegenerate ) {

			// based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
			var te = this.elements,
				me = m.elements,

				n11 = me[ 0 ], n21 = me[ 1 ], n31 = me[ 2 ], n41 = me[ 3 ],
				n12 = me[ 4 ], n22 = me[ 5 ], n32 = me[ 6 ], n42 = me[ 7 ],
				n13 = me[ 8 ], n23 = me[ 9 ], n33 = me[ 10 ], n43 = me[ 11 ],
				n14 = me[ 12 ], n24 = me[ 13 ], n34 = me[ 14 ], n44 = me[ 15 ],

				t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44,
				t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44,
				t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44,
				t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

			var det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

			if ( det === 0 ) {

				var msg = "THREE.Matrix4: .getInverse() can't invert matrix, determinant is 0";

				if ( throwOnDegenerate === true ) {

					throw new Error( msg );

				} else {

					console.warn( msg );

				}

				return this.identity();

			}

			var detInv = 1 / det;

			te[ 0 ] = t11 * detInv;
			te[ 1 ] = ( n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44 ) * detInv;
			te[ 2 ] = ( n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44 ) * detInv;
			te[ 3 ] = ( n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43 ) * detInv;

			te[ 4 ] = t12 * detInv;
			te[ 5 ] = ( n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44 ) * detInv;
			te[ 6 ] = ( n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44 ) * detInv;
			te[ 7 ] = ( n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43 ) * detInv;

			te[ 8 ] = t13 * detInv;
			te[ 9 ] = ( n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44 ) * detInv;
			te[ 10 ] = ( n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44 ) * detInv;
			te[ 11 ] = ( n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43 ) * detInv;

			te[ 12 ] = t14 * detInv;
			te[ 13 ] = ( n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34 ) * detInv;
			te[ 14 ] = ( n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34 ) * detInv;
			te[ 15 ] = ( n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33 ) * detInv;

			return this;

		},

		scale: function ( v ) {

			var te = this.elements;
			var x = v.x, y = v.y, z = v.z;

			te[ 0 ] *= x; te[ 4 ] *= y; te[ 8 ] *= z;
			te[ 1 ] *= x; te[ 5 ] *= y; te[ 9 ] *= z;
			te[ 2 ] *= x; te[ 6 ] *= y; te[ 10 ] *= z;
			te[ 3 ] *= x; te[ 7 ] *= y; te[ 11 ] *= z;

			return this;

		},

		getMaxScaleOnAxis: function () {

			var te = this.elements;

			var scaleXSq = te[ 0 ] * te[ 0 ] + te[ 1 ] * te[ 1 ] + te[ 2 ] * te[ 2 ];
			var scaleYSq = te[ 4 ] * te[ 4 ] + te[ 5 ] * te[ 5 ] + te[ 6 ] * te[ 6 ];
			var scaleZSq = te[ 8 ] * te[ 8 ] + te[ 9 ] * te[ 9 ] + te[ 10 ] * te[ 10 ];

			return Math.sqrt( Math.max( scaleXSq, scaleYSq, scaleZSq ) );

		},

		makeTranslation: function ( x, y, z ) {

			this.set(

				1, 0, 0, x,
				0, 1, 0, y,
				0, 0, 1, z,
				0, 0, 0, 1

			);

			return this;

		},

		makeRotationX: function ( theta ) {

			var c = Math.cos( theta ), s = Math.sin( theta );

			this.set(

				1, 0, 0, 0,
				0, c, - s, 0,
				0, s, c, 0,
				0, 0, 0, 1

			);

			return this;

		},

		makeRotationY: function ( theta ) {

			var c = Math.cos( theta ), s = Math.sin( theta );

			this.set(

				 c, 0, s, 0,
				 0, 1, 0, 0,
				- s, 0, c, 0,
				 0, 0, 0, 1

			);

			return this;

		},

		makeRotationZ: function ( theta ) {

			var c = Math.cos( theta ), s = Math.sin( theta );

			this.set(

				c, - s, 0, 0,
				s, c, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1

			);

			return this;

		},

		makeRotationAxis: function ( axis, angle ) {

			// Based on http://www.gamedev.net/reference/articles/article1199.asp

			var c = Math.cos( angle );
			var s = Math.sin( angle );
			var t = 1 - c;
			var x = axis.x, y = axis.y, z = axis.z;
			var tx = t * x, ty = t * y;

			this.set(

				tx * x + c, tx * y - s * z, tx * z + s * y, 0,
				tx * y + s * z, ty * y + c, ty * z - s * x, 0,
				tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
				0, 0, 0, 1

			);

			 return this;

		},

		makeScale: function ( x, y, z ) {

			this.set(

				x, 0, 0, 0,
				0, y, 0, 0,
				0, 0, z, 0,
				0, 0, 0, 1

			);

			return this;

		},

		makeShear: function ( x, y, z ) {

			this.set(

				1, y, z, 0,
				x, 1, z, 0,
				x, y, 1, 0,
				0, 0, 0, 1

			);

			return this;

		},

		compose: function ( position, quaternion, scale ) {

			this.makeRotationFromQuaternion( quaternion );
			this.scale( scale );
			this.setPosition( position );

			return this;

		},

		decompose: function () {

			var vector = new Vector3();
			var matrix = new Matrix4();

			return function decompose( position, quaternion, scale ) {

				var te = this.elements;

				var sx = vector.set( te[ 0 ], te[ 1 ], te[ 2 ] ).length();
				var sy = vector.set( te[ 4 ], te[ 5 ], te[ 6 ] ).length();
				var sz = vector.set( te[ 8 ], te[ 9 ], te[ 10 ] ).length();

				// if determine is negative, we need to invert one scale
				var det = this.determinant();
				if ( det < 0 ) sx = - sx;

				position.x = te[ 12 ];
				position.y = te[ 13 ];
				position.z = te[ 14 ];

				// scale the rotation part
				matrix.copy( this );

				var invSX = 1 / sx;
				var invSY = 1 / sy;
				var invSZ = 1 / sz;

				matrix.elements[ 0 ] *= invSX;
				matrix.elements[ 1 ] *= invSX;
				matrix.elements[ 2 ] *= invSX;

				matrix.elements[ 4 ] *= invSY;
				matrix.elements[ 5 ] *= invSY;
				matrix.elements[ 6 ] *= invSY;

				matrix.elements[ 8 ] *= invSZ;
				matrix.elements[ 9 ] *= invSZ;
				matrix.elements[ 10 ] *= invSZ;

				quaternion.setFromRotationMatrix( matrix );

				scale.x = sx;
				scale.y = sy;
				scale.z = sz;

				return this;

			};

		}(),

		makePerspective: function ( left, right, top, bottom, near, far ) {

			if ( far === undefined ) {

				console.warn( 'THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs.' );

			}

			var te = this.elements;
			var x = 2 * near / ( right - left );
			var y = 2 * near / ( top - bottom );

			var a = ( right + left ) / ( right - left );
			var b = ( top + bottom ) / ( top - bottom );
			var c = - ( far + near ) / ( far - near );
			var d = - 2 * far * near / ( far - near );

			te[ 0 ] = x;	te[ 4 ] = 0;	te[ 8 ] = a;	te[ 12 ] = 0;
			te[ 1 ] = 0;	te[ 5 ] = y;	te[ 9 ] = b;	te[ 13 ] = 0;
			te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = c;	te[ 14 ] = d;
			te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = - 1;	te[ 15 ] = 0;

			return this;

		},

		makeOrthographic: function ( left, right, top, bottom, near, far ) {

			var te = this.elements;
			var w = 1.0 / ( right - left );
			var h = 1.0 / ( top - bottom );
			var p = 1.0 / ( far - near );

			var x = ( right + left ) * w;
			var y = ( top + bottom ) * h;
			var z = ( far + near ) * p;

			te[ 0 ] = 2 * w;	te[ 4 ] = 0;	te[ 8 ] = 0;	te[ 12 ] = - x;
			te[ 1 ] = 0;	te[ 5 ] = 2 * h;	te[ 9 ] = 0;	te[ 13 ] = - y;
			te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = - 2 * p;	te[ 14 ] = - z;
			te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = 0;	te[ 15 ] = 1;

			return this;

		},

		equals: function ( matrix ) {

			var te = this.elements;
			var me = matrix.elements;

			for ( var i = 0; i < 16; i ++ ) {

				if ( te[ i ] !== me[ i ] ) return false;

			}

			return true;

		},

		fromArray: function ( array, offset ) {

			if ( offset === undefined ) offset = 0;

			for ( var i = 0; i < 16; i ++ ) {

				this.elements[ i ] = array[ i + offset ];

			}

			return this;

		},

		toArray: function ( array, offset ) {

			if ( array === undefined ) array = [];
			if ( offset === undefined ) offset = 0;

			var te = this.elements;

			array[ offset ] = te[ 0 ];
			array[ offset + 1 ] = te[ 1 ];
			array[ offset + 2 ] = te[ 2 ];
			array[ offset + 3 ] = te[ 3 ];

			array[ offset + 4 ] = te[ 4 ];
			array[ offset + 5 ] = te[ 5 ];
			array[ offset + 6 ] = te[ 6 ];
			array[ offset + 7 ] = te[ 7 ];

			array[ offset + 8 ] = te[ 8 ];
			array[ offset + 9 ] = te[ 9 ];
			array[ offset + 10 ] = te[ 10 ];
			array[ offset + 11 ] = te[ 11 ];

			array[ offset + 12 ] = te[ 12 ];
			array[ offset + 13 ] = te[ 13 ];
			array[ offset + 14 ] = te[ 14 ];
			array[ offset + 15 ] = te[ 15 ];

			return array;

		}

	} );

	/**
	 * @author mikael emtinger / http://gomo.se/
	 * @author alteredq / http://alteredqualia.com/
	 * @author WestLangley / http://github.com/WestLangley
	 * @author bhouston / http://clara.io
	 */

	function Quaternion( x, y, z, w ) {

		this._x = x || 0;
		this._y = y || 0;
		this._z = z || 0;
		this._w = ( w !== undefined ) ? w : 1;

	}

	Object.assign( Quaternion, {

		slerp: function ( qa, qb, qm, t ) {

			return qm.copy( qa ).slerp( qb, t );

		},

		slerpFlat: function ( dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t ) {

			// fuzz-free, array-based Quaternion SLERP operation

			var x0 = src0[ srcOffset0 + 0 ],
				y0 = src0[ srcOffset0 + 1 ],
				z0 = src0[ srcOffset0 + 2 ],
				w0 = src0[ srcOffset0 + 3 ],

				x1 = src1[ srcOffset1 + 0 ],
				y1 = src1[ srcOffset1 + 1 ],
				z1 = src1[ srcOffset1 + 2 ],
				w1 = src1[ srcOffset1 + 3 ];

			if ( w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1 ) {

				var s = 1 - t,

					cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1,

					dir = ( cos >= 0 ? 1 : - 1 ),
					sqrSin = 1 - cos * cos;

				// Skip the Slerp for tiny steps to avoid numeric problems:
				if ( sqrSin > Number.EPSILON ) {

					var sin = Math.sqrt( sqrSin ),
						len = Math.atan2( sin, cos * dir );

					s = Math.sin( s * len ) / sin;
					t = Math.sin( t * len ) / sin;

				}

				var tDir = t * dir;

				x0 = x0 * s + x1 * tDir;
				y0 = y0 * s + y1 * tDir;
				z0 = z0 * s + z1 * tDir;
				w0 = w0 * s + w1 * tDir;

				// Normalize in case we just did a lerp:
				if ( s === 1 - t ) {

					var f = 1 / Math.sqrt( x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0 );

					x0 *= f;
					y0 *= f;
					z0 *= f;
					w0 *= f;

				}

			}

			dst[ dstOffset ] = x0;
			dst[ dstOffset + 1 ] = y0;
			dst[ dstOffset + 2 ] = z0;
			dst[ dstOffset + 3 ] = w0;

		}

	} );

	Object.defineProperties( Quaternion.prototype, {

		x: {

			get: function () {

				return this._x;

			},

			set: function ( value ) {

				this._x = value;
				this.onChangeCallback();

			}

		},

		y: {

			get: function () {

				return this._y;

			},

			set: function ( value ) {

				this._y = value;
				this.onChangeCallback();

			}

		},

		z: {

			get: function () {

				return this._z;

			},

			set: function ( value ) {

				this._z = value;
				this.onChangeCallback();

			}

		},

		w: {

			get: function () {

				return this._w;

			},

			set: function ( value ) {

				this._w = value;
				this.onChangeCallback();

			}

		}

	} );

	Object.assign( Quaternion.prototype, {

		set: function ( x, y, z, w ) {

			this._x = x;
			this._y = y;
			this._z = z;
			this._w = w;

			this.onChangeCallback();

			return this;

		},

		clone: function () {

			return new this.constructor( this._x, this._y, this._z, this._w );

		},

		copy: function ( quaternion ) {

			this._x = quaternion.x;
			this._y = quaternion.y;
			this._z = quaternion.z;
			this._w = quaternion.w;

			this.onChangeCallback();

			return this;

		},

		setFromEuler: function ( euler, update ) {

			if ( ! ( euler && euler.isEuler ) ) {

				throw new Error( 'THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.' );

			}

			var x = euler._x, y = euler._y, z = euler._z, order = euler.order;

			// http://www.mathworks.com/matlabcentral/fileexchange/
			// 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
			//	content/SpinCalc.m

			var cos = Math.cos;
			var sin = Math.sin;

			var c1 = cos( x / 2 );
			var c2 = cos( y / 2 );
			var c3 = cos( z / 2 );

			var s1 = sin( x / 2 );
			var s2 = sin( y / 2 );
			var s3 = sin( z / 2 );

			if ( order === 'XYZ' ) {

				this._x = s1 * c2 * c3 + c1 * s2 * s3;
				this._y = c1 * s2 * c3 - s1 * c2 * s3;
				this._z = c1 * c2 * s3 + s1 * s2 * c3;
				this._w = c1 * c2 * c3 - s1 * s2 * s3;

			} else if ( order === 'YXZ' ) {

				this._x = s1 * c2 * c3 + c1 * s2 * s3;
				this._y = c1 * s2 * c3 - s1 * c2 * s3;
				this._z = c1 * c2 * s3 - s1 * s2 * c3;
				this._w = c1 * c2 * c3 + s1 * s2 * s3;

			} else if ( order === 'ZXY' ) {

				this._x = s1 * c2 * c3 - c1 * s2 * s3;
				this._y = c1 * s2 * c3 + s1 * c2 * s3;
				this._z = c1 * c2 * s3 + s1 * s2 * c3;
				this._w = c1 * c2 * c3 - s1 * s2 * s3;

			} else if ( order === 'ZYX' ) {

				this._x = s1 * c2 * c3 - c1 * s2 * s3;
				this._y = c1 * s2 * c3 + s1 * c2 * s3;
				this._z = c1 * c2 * s3 - s1 * s2 * c3;
				this._w = c1 * c2 * c3 + s1 * s2 * s3;

			} else if ( order === 'YZX' ) {

				this._x = s1 * c2 * c3 + c1 * s2 * s3;
				this._y = c1 * s2 * c3 + s1 * c2 * s3;
				this._z = c1 * c2 * s3 - s1 * s2 * c3;
				this._w = c1 * c2 * c3 - s1 * s2 * s3;

			} else if ( order === 'XZY' ) {

				this._x = s1 * c2 * c3 - c1 * s2 * s3;
				this._y = c1 * s2 * c3 - s1 * c2 * s3;
				this._z = c1 * c2 * s3 + s1 * s2 * c3;
				this._w = c1 * c2 * c3 + s1 * s2 * s3;

			}

			if ( update !== false ) this.onChangeCallback();

			return this;

		},

		setFromAxisAngle: function ( axis, angle ) {

			// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm

			// assumes axis is normalized

			var halfAngle = angle / 2, s = Math.sin( halfAngle );

			this._x = axis.x * s;
			this._y = axis.y * s;
			this._z = axis.z * s;
			this._w = Math.cos( halfAngle );

			this.onChangeCallback();

			return this;

		},

		setFromRotationMatrix: function ( m ) {

			// http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

			// assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

			var te = m.elements,

				m11 = te[ 0 ], m12 = te[ 4 ], m13 = te[ 8 ],
				m21 = te[ 1 ], m22 = te[ 5 ], m23 = te[ 9 ],
				m31 = te[ 2 ], m32 = te[ 6 ], m33 = te[ 10 ],

				trace = m11 + m22 + m33,
				s;

			if ( trace > 0 ) {

				s = 0.5 / Math.sqrt( trace + 1.0 );

				this._w = 0.25 / s;
				this._x = ( m32 - m23 ) * s;
				this._y = ( m13 - m31 ) * s;
				this._z = ( m21 - m12 ) * s;

			} else if ( m11 > m22 && m11 > m33 ) {

				s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );

				this._w = ( m32 - m23 ) / s;
				this._x = 0.25 * s;
				this._y = ( m12 + m21 ) / s;
				this._z = ( m13 + m31 ) / s;

			} else if ( m22 > m33 ) {

				s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );

				this._w = ( m13 - m31 ) / s;
				this._x = ( m12 + m21 ) / s;
				this._y = 0.25 * s;
				this._z = ( m23 + m32 ) / s;

			} else {

				s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );

				this._w = ( m21 - m12 ) / s;
				this._x = ( m13 + m31 ) / s;
				this._y = ( m23 + m32 ) / s;
				this._z = 0.25 * s;

			}

			this.onChangeCallback();

			return this;

		},

		setFromUnitVectors: function () {

			// assumes direction vectors vFrom and vTo are normalized

			var v1 = new Vector3();
			var r;

			var EPS = 0.000001;

			return function setFromUnitVectors( vFrom, vTo ) {

				if ( v1 === undefined ) v1 = new Vector3();

				r = vFrom.dot( vTo ) + 1;

				if ( r < EPS ) {

					r = 0;

					if ( Math.abs( vFrom.x ) > Math.abs( vFrom.z ) ) {

						v1.set( - vFrom.y, vFrom.x, 0 );

					} else {

						v1.set( 0, - vFrom.z, vFrom.y );

					}

				} else {

					v1.crossVectors( vFrom, vTo );

				}

				this._x = v1.x;
				this._y = v1.y;
				this._z = v1.z;
				this._w = r;

				return this.normalize();

			};

		}(),

		inverse: function () {

			return this.conjugate().normalize();

		},

		conjugate: function () {

			this._x *= - 1;
			this._y *= - 1;
			this._z *= - 1;

			this.onChangeCallback();

			return this;

		},

		dot: function ( v ) {

			return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;

		},

		lengthSq: function () {

			return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;

		},

		length: function () {

			return Math.sqrt( this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w );

		},

		normalize: function () {

			var l = this.length();

			if ( l === 0 ) {

				this._x = 0;
				this._y = 0;
				this._z = 0;
				this._w = 1;

			} else {

				l = 1 / l;

				this._x = this._x * l;
				this._y = this._y * l;
				this._z = this._z * l;
				this._w = this._w * l;

			}

			this.onChangeCallback();

			return this;

		},

		multiply: function ( q, p ) {

			if ( p !== undefined ) {

				console.warn( 'THREE.Quaternion: .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead.' );
				return this.multiplyQuaternions( q, p );

			}

			return this.multiplyQuaternions( this, q );

		},

		premultiply: function ( q ) {

			return this.multiplyQuaternions( q, this );

		},

		multiplyQuaternions: function ( a, b ) {

			// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

			var qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
			var qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;

			this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
			this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
			this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
			this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

			this.onChangeCallback();

			return this;

		},

		slerp: function ( qb, t ) {

			if ( t === 0 ) return this;
			if ( t === 1 ) return this.copy( qb );

			var x = this._x, y = this._y, z = this._z, w = this._w;

			// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

			var cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;

			if ( cosHalfTheta < 0 ) {

				this._w = - qb._w;
				this._x = - qb._x;
				this._y = - qb._y;
				this._z = - qb._z;

				cosHalfTheta = - cosHalfTheta;

			} else {

				this.copy( qb );

			}

			if ( cosHalfTheta >= 1.0 ) {

				this._w = w;
				this._x = x;
				this._y = y;
				this._z = z;

				return this;

			}

			var sinHalfTheta = Math.sqrt( 1.0 - cosHalfTheta * cosHalfTheta );

			if ( Math.abs( sinHalfTheta ) < 0.001 ) {

				this._w = 0.5 * ( w + this._w );
				this._x = 0.5 * ( x + this._x );
				this._y = 0.5 * ( y + this._y );
				this._z = 0.5 * ( z + this._z );

				return this;

			}

			var halfTheta = Math.atan2( sinHalfTheta, cosHalfTheta );
			var ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta,
				ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;

			this._w = ( w * ratioA + this._w * ratioB );
			this._x = ( x * ratioA + this._x * ratioB );
			this._y = ( y * ratioA + this._y * ratioB );
			this._z = ( z * ratioA + this._z * ratioB );

			this.onChangeCallback();

			return this;

		},

		equals: function ( quaternion ) {

			return ( quaternion._x === this._x ) && ( quaternion._y === this._y ) && ( quaternion._z === this._z ) && ( quaternion._w === this._w );

		},

		fromArray: function ( array, offset ) {

			if ( offset === undefined ) offset = 0;

			this._x = array[ offset ];
			this._y = array[ offset + 1 ];
			this._z = array[ offset + 2 ];
			this._w = array[ offset + 3 ];

			this.onChangeCallback();

			return this;

		},

		toArray: function ( array, offset ) {

			if ( array === undefined ) array = [];
			if ( offset === undefined ) offset = 0;

			array[ offset ] = this._x;
			array[ offset + 1 ] = this._y;
			array[ offset + 2 ] = this._z;
			array[ offset + 3 ] = this._w;

			return array;

		},

		onChange: function ( callback ) {

			this.onChangeCallback = callback;

			return this;

		},

		onChangeCallback: function () {}

	} );

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author kile / http://kile.stravaganza.org/
	 * @author philogb / http://blog.thejit.org/
	 * @author mikael emtinger / http://gomo.se/
	 * @author egraether / http://egraether.com/
	 * @author WestLangley / http://github.com/WestLangley
	 */

	function Vector3( x, y, z ) {

		this.x = x || 0;
		this.y = y || 0;
		this.z = z || 0;

	}

	Object.assign( Vector3.prototype, {

		isVector3: true,

		set: function ( x, y, z ) {

			this.x = x;
			this.y = y;
			this.z = z;

			return this;

		},

		setScalar: function ( scalar ) {

			this.x = scalar;
			this.y = scalar;
			this.z = scalar;

			return this;

		},

		setX: function ( x ) {

			this.x = x;

			return this;

		},

		setY: function ( y ) {

			this.y = y;

			return this;

		},

		setZ: function ( z ) {

			this.z = z;

			return this;

		},

		setComponent: function ( index, value ) {

			switch ( index ) {

				case 0: this.x = value; break;
				case 1: this.y = value; break;
				case 2: this.z = value; break;
				default: throw new Error( 'index is out of range: ' + index );

			}

			return this;

		},

		getComponent: function ( index ) {

			switch ( index ) {

				case 0: return this.x;
				case 1: return this.y;
				case 2: return this.z;
				default: throw new Error( 'index is out of range: ' + index );

			}

		},

		clone: function () {

			return new this.constructor( this.x, this.y, this.z );

		},

		copy: function ( v ) {

			this.x = v.x;
			this.y = v.y;
			this.z = v.z;

			return this;

		},

		add: function ( v, w ) {

			if ( w !== undefined ) {

				console.warn( 'THREE.Vector3: .add() now only accepts one argument. Use .addVectors( a, b ) instead.' );
				return this.addVectors( v, w );

			}

			this.x += v.x;
			this.y += v.y;
			this.z += v.z;

			return this;

		},

		addScalar: function ( s ) {

			this.x += s;
			this.y += s;
			this.z += s;

			return this;

		},

		addVectors: function ( a, b ) {

			this.x = a.x + b.x;
			this.y = a.y + b.y;
			this.z = a.z + b.z;

			return this;

		},

		addScaledVector: function ( v, s ) {

			this.x += v.x * s;
			this.y += v.y * s;
			this.z += v.z * s;

			return this;

		},

		sub: function ( v, w ) {

			if ( w !== undefined ) {

				console.warn( 'THREE.Vector3: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.' );
				return this.subVectors( v, w );

			}

			this.x -= v.x;
			this.y -= v.y;
			this.z -= v.z;

			return this;

		},

		subScalar: function ( s ) {

			this.x -= s;
			this.y -= s;
			this.z -= s;

			return this;

		},

		subVectors: function ( a, b ) {

			this.x = a.x - b.x;
			this.y = a.y - b.y;
			this.z = a.z - b.z;

			return this;

		},

		multiply: function ( v, w ) {

			if ( w !== undefined ) {

				console.warn( 'THREE.Vector3: .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead.' );
				return this.multiplyVectors( v, w );

			}

			this.x *= v.x;
			this.y *= v.y;
			this.z *= v.z;

			return this;

		},

		multiplyScalar: function ( scalar ) {

			this.x *= scalar;
			this.y *= scalar;
			this.z *= scalar;

			return this;

		},

		multiplyVectors: function ( a, b ) {

			this.x = a.x * b.x;
			this.y = a.y * b.y;
			this.z = a.z * b.z;

			return this;

		},

		applyEuler: function () {

			var quaternion = new Quaternion();

			return function applyEuler( euler ) {

				if ( ! ( euler && euler.isEuler ) ) {

					console.error( 'THREE.Vector3: .applyEuler() now expects an Euler rotation rather than a Vector3 and order.' );

				}

				return this.applyQuaternion( quaternion.setFromEuler( euler ) );

			};

		}(),

		applyAxisAngle: function () {

			var quaternion = new Quaternion();

			return function applyAxisAngle( axis, angle ) {

				return this.applyQuaternion( quaternion.setFromAxisAngle( axis, angle ) );

			};

		}(),

		applyMatrix3: function ( m ) {

			var x = this.x, y = this.y, z = this.z;
			var e = m.elements;

			this.x = e[ 0 ] * x + e[ 3 ] * y + e[ 6 ] * z;
			this.y = e[ 1 ] * x + e[ 4 ] * y + e[ 7 ] * z;
			this.z = e[ 2 ] * x + e[ 5 ] * y + e[ 8 ] * z;

			return this;

		},

		applyMatrix4: function ( m ) {

			var x = this.x, y = this.y, z = this.z;
			var e = m.elements;

			var w = 1 / ( e[ 3 ] * x + e[ 7 ] * y + e[ 11 ] * z + e[ 15 ] );

			this.x = ( e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z + e[ 12 ] ) * w;
			this.y = ( e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z + e[ 13 ] ) * w;
			this.z = ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * w;

			return this;

		},

		applyQuaternion: function ( q ) {

			var x = this.x, y = this.y, z = this.z;
			var qx = q.x, qy = q.y, qz = q.z, qw = q.w;

			// calculate quat * vector

			var ix = qw * x + qy * z - qz * y;
			var iy = qw * y + qz * x - qx * z;
			var iz = qw * z + qx * y - qy * x;
			var iw = - qx * x - qy * y - qz * z;

			// calculate result * inverse quat

			this.x = ix * qw + iw * - qx + iy * - qz - iz * - qy;
			this.y = iy * qw + iw * - qy + iz * - qx - ix * - qz;
			this.z = iz * qw + iw * - qz + ix * - qy - iy * - qx;

			return this;

		},

		project: function () {

			var matrix = new Matrix4();

			return function project( camera ) {

				matrix.multiplyMatrices( camera.projectionMatrix, matrix.getInverse( camera.matrixWorld ) );
				return this.applyMatrix4( matrix );

			};

		}(),

		unproject: function () {

			var matrix = new Matrix4();

			return function unproject( camera ) {

				matrix.multiplyMatrices( camera.matrixWorld, matrix.getInverse( camera.projectionMatrix ) );
				return this.applyMatrix4( matrix );

			};

		}(),

		transformDirection: function ( m ) {

			// input: THREE.Matrix4 affine matrix
			// vector interpreted as a direction

			var x = this.x, y = this.y, z = this.z;
			var e = m.elements;

			this.x = e[ 0 ] * x + e[ 4 ] * y + e[ 8 ] * z;
			this.y = e[ 1 ] * x + e[ 5 ] * y + e[ 9 ] * z;
			this.z = e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z;

			return this.normalize();

		},

		divide: function ( v ) {

			this.x /= v.x;
			this.y /= v.y;
			this.z /= v.z;

			return this;

		},

		divideScalar: function ( scalar ) {

			return this.multiplyScalar( 1 / scalar );

		},

		min: function ( v ) {

			this.x = Math.min( this.x, v.x );
			this.y = Math.min( this.y, v.y );
			this.z = Math.min( this.z, v.z );

			return this;

		},

		max: function ( v ) {

			this.x = Math.max( this.x, v.x );
			this.y = Math.max( this.y, v.y );
			this.z = Math.max( this.z, v.z );

			return this;

		},

		clamp: function ( min, max ) {

			// assumes min < max, componentwise

			this.x = Math.max( min.x, Math.min( max.x, this.x ) );
			this.y = Math.max( min.y, Math.min( max.y, this.y ) );
			this.z = Math.max( min.z, Math.min( max.z, this.z ) );

			return this;

		},

		clampScalar: function () {

			var min = new Vector3();
			var max = new Vector3();

			return function clampScalar( minVal, maxVal ) {

				min.set( minVal, minVal, minVal );
				max.set( maxVal, maxVal, maxVal );

				return this.clamp( min, max );

			};

		}(),

		clampLength: function ( min, max ) {

			var length = this.length();

			return this.divideScalar( length || 1 ).multiplyScalar( Math.max( min, Math.min( max, length ) ) );

		},

		floor: function () {

			this.x = Math.floor( this.x );
			this.y = Math.floor( this.y );
			this.z = Math.floor( this.z );

			return this;

		},

		ceil: function () {

			this.x = Math.ceil( this.x );
			this.y = Math.ceil( this.y );
			this.z = Math.ceil( this.z );

			return this;

		},

		round: function () {

			this.x = Math.round( this.x );
			this.y = Math.round( this.y );
			this.z = Math.round( this.z );

			return this;

		},

		roundToZero: function () {

			this.x = ( this.x < 0 ) ? Math.ceil( this.x ) : Math.floor( this.x );
			this.y = ( this.y < 0 ) ? Math.ceil( this.y ) : Math.floor( this.y );
			this.z = ( this.z < 0 ) ? Math.ceil( this.z ) : Math.floor( this.z );

			return this;

		},

		negate: function () {

			this.x = - this.x;
			this.y = - this.y;
			this.z = - this.z;

			return this;

		},

		dot: function ( v ) {

			return this.x * v.x + this.y * v.y + this.z * v.z;

		},

		// TODO lengthSquared?

		lengthSq: function () {

			return this.x * this.x + this.y * this.y + this.z * this.z;

		},

		length: function () {

			return Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z );

		},

		manhattanLength: function () {

			return Math.abs( this.x ) + Math.abs( this.y ) + Math.abs( this.z );

		},

		normalize: function () {

			return this.divideScalar( this.length() || 1 );

		},

		setLength: function ( length ) {

			return this.normalize().multiplyScalar( length );

		},

		lerp: function ( v, alpha ) {

			this.x += ( v.x - this.x ) * alpha;
			this.y += ( v.y - this.y ) * alpha;
			this.z += ( v.z - this.z ) * alpha;

			return this;

		},

		lerpVectors: function ( v1, v2, alpha ) {

			return this.subVectors( v2, v1 ).multiplyScalar( alpha ).add( v1 );

		},

		cross: function ( v, w ) {

			if ( w !== undefined ) {

				console.warn( 'THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead.' );
				return this.crossVectors( v, w );

			}

			return this.crossVectors( this, v );

		},

		crossVectors: function ( a, b ) {

			var ax = a.x, ay = a.y, az = a.z;
			var bx = b.x, by = b.y, bz = b.z;

			this.x = ay * bz - az * by;
			this.y = az * bx - ax * bz;
			this.z = ax * by - ay * bx;

			return this;

		},

		projectOnVector: function ( vector ) {

			var scalar = vector.dot( this ) / vector.lengthSq();

			return this.copy( vector ).multiplyScalar( scalar );

		},

		projectOnPlane: function () {

			var v1 = new Vector3();

			return function projectOnPlane( planeNormal ) {

				v1.copy( this ).projectOnVector( planeNormal );

				return this.sub( v1 );

			};

		}(),

		reflect: function () {

			// reflect incident vector off plane orthogonal to normal
			// normal is assumed to have unit length

			var v1 = new Vector3();

			return function reflect( normal ) {

				return this.sub( v1.copy( normal ).multiplyScalar( 2 * this.dot( normal ) ) );

			};

		}(),

		angleTo: function ( v ) {

			var theta = this.dot( v ) / ( Math.sqrt( this.lengthSq() * v.lengthSq() ) );

			// clamp, to handle numerical problems

			return Math.acos( _Math.clamp( theta, - 1, 1 ) );

		},

		distanceTo: function ( v ) {

			return Math.sqrt( this.distanceToSquared( v ) );

		},

		distanceToSquared: function ( v ) {

			var dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;

			return dx * dx + dy * dy + dz * dz;

		},

		manhattanDistanceTo: function ( v ) {

			return Math.abs( this.x - v.x ) + Math.abs( this.y - v.y ) + Math.abs( this.z - v.z );

		},

		setFromSpherical: function ( s ) {

			var sinPhiRadius = Math.sin( s.phi ) * s.radius;

			this.x = sinPhiRadius * Math.sin( s.theta );
			this.y = Math.cos( s.phi ) * s.radius;
			this.z = sinPhiRadius * Math.cos( s.theta );

			return this;

		},

		setFromCylindrical: function ( c ) {

			this.x = c.radius * Math.sin( c.theta );
			this.y = c.y;
			this.z = c.radius * Math.cos( c.theta );

			return this;

		},

		setFromMatrixPosition: function ( m ) {

			var e = m.elements;

			this.x = e[ 12 ];
			this.y = e[ 13 ];
			this.z = e[ 14 ];

			return this;

		},

		setFromMatrixScale: function ( m ) {

			var sx = this.setFromMatrixColumn( m, 0 ).length();
			var sy = this.setFromMatrixColumn( m, 1 ).length();
			var sz = this.setFromMatrixColumn( m, 2 ).length();

			this.x = sx;
			this.y = sy;
			this.z = sz;

			return this;

		},

		setFromMatrixColumn: function ( m, index ) {

			return this.fromArray( m.elements, index * 4 );

		},

		equals: function ( v ) {

			return ( ( v.x === this.x ) && ( v.y === this.y ) && ( v.z === this.z ) );

		},

		fromArray: function ( array, offset ) {

			if ( offset === undefined ) offset = 0;

			this.x = array[ offset ];
			this.y = array[ offset + 1 ];
			this.z = array[ offset + 2 ];

			return this;

		},

		toArray: function ( array, offset ) {

			if ( array === undefined ) array = [];
			if ( offset === undefined ) offset = 0;

			array[ offset ] = this.x;
			array[ offset + 1 ] = this.y;
			array[ offset + 2 ] = this.z;

			return array;

		},

		fromBufferAttribute: function ( attribute, index, offset ) {

			if ( offset !== undefined ) {

				console.warn( 'THREE.Vector3: offset has been removed from .fromBufferAttribute().' );

			}

			this.x = attribute.getX( index );
			this.y = attribute.getY( index );
			this.z = attribute.getZ( index );

			return this;

		}

	} );

	/**
	 * @author WestLangley / http://github.com/WestLangley
	 *
	 * parameters = {
	 *
	 *  referencePosition: <float>,
	 *  nearDistance: <float>,
	 *  farDistance: <float>,
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>,
	 *
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  alphaMap: new THREE.Texture( <Image> ),
	 *
	 *  displacementMap: new THREE.Texture( <Image> ),
	 *  displacementScale: <float>,
	 *  displacementBias: <float>
	 *
	 * }
	 */

	function MeshDistanceMaterial( parameters ) {

		Material.call( this );

		this.type = 'MeshDistanceMaterial';

		this.referencePosition = new Vector3();
		this.nearDistance = 1;
		this.farDistance = 1000;

		this.skinning = false;
		this.morphTargets = false;

		this.map = null;

		this.alphaMap = null;

		this.displacementMap = null;
		this.displacementScale = 1;
		this.displacementBias = 0;

		this.fog = false;
		this.lights = false;

		this.setValues( parameters );

	}

	MeshDistanceMaterial.prototype = Object.create( Material.prototype );
	MeshDistanceMaterial.prototype.constructor = MeshDistanceMaterial;

	MeshDistanceMaterial.prototype.isMeshDistanceMaterial = true;

	MeshDistanceMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.referencePosition.copy( source.referencePosition );
		this.nearDistance = source.nearDistance;
		this.farDistance = source.farDistance;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;

		this.map = source.map;

		this.alphaMap = source.alphaMap;

		this.displacementMap = source.displacementMap;
		this.displacementScale = source.displacementScale;
		this.displacementBias = source.displacementBias;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  opacity: <float>,
	 *  map: new THREE.Texture( <Image> ),
	 *
	 *  lightMap: new THREE.Texture( <Image> ),
	 *  lightMapIntensity: <float>
	 *
	 *  aoMap: new THREE.Texture( <Image> ),
	 *  aoMapIntensity: <float>
	 *
	 *  specularMap: new THREE.Texture( <Image> ),
	 *
	 *  alphaMap: new THREE.Texture( <Image> ),
	 *
	 *  envMap: new THREE.TextureCube( [posx, negx, posy, negy, posz, negz] ),
	 *  combine: THREE.Multiply,
	 *  reflectivity: <float>,
	 *  refractionRatio: <float>,
	 *
	 *  depthTest: <bool>,
	 *  depthWrite: <bool>,
	 *
	 *  wireframe: <boolean>,
	 *  wireframeLinewidth: <float>,
	 *
	 *  skinning: <bool>,
	 *  morphTargets: <bool>
	 * }
	 */

	function MeshBasicMaterial( parameters ) {

		Material.call( this );

		this.type = 'MeshBasicMaterial';

		this.color = new Color( 0xffffff ); // emissive

		this.map = null;

		this.lightMap = null;
		this.lightMapIntensity = 1.0;

		this.aoMap = null;
		this.aoMapIntensity = 1.0;

		this.specularMap = null;

		this.alphaMap = null;

		this.envMap = null;
		this.combine = MultiplyOperation;
		this.reflectivity = 1;
		this.refractionRatio = 0.98;

		this.wireframe = false;
		this.wireframeLinewidth = 1;
		this.wireframeLinecap = 'round';
		this.wireframeLinejoin = 'round';

		this.skinning = false;
		this.morphTargets = false;

		this.lights = false;

		this.setValues( parameters );

	}

	MeshBasicMaterial.prototype = Object.create( Material.prototype );
	MeshBasicMaterial.prototype.constructor = MeshBasicMaterial;

	MeshBasicMaterial.prototype.isMeshBasicMaterial = true;

	MeshBasicMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.color.copy( source.color );

		this.map = source.map;

		this.lightMap = source.lightMap;
		this.lightMapIntensity = source.lightMapIntensity;

		this.aoMap = source.aoMap;
		this.aoMapIntensity = source.aoMapIntensity;

		this.specularMap = source.specularMap;

		this.alphaMap = source.alphaMap;

		this.envMap = source.envMap;
		this.combine = source.combine;
		this.reflectivity = source.reflectivity;
		this.refractionRatio = source.refractionRatio;

		this.wireframe = source.wireframe;
		this.wireframeLinewidth = source.wireframeLinewidth;
		this.wireframeLinecap = source.wireframeLinecap;
		this.wireframeLinejoin = source.wireframeLinejoin;

		this.skinning = source.skinning;
		this.morphTargets = source.morphTargets;

		return this;

	};

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  opacity: <float>,
	 *
	 *  linewidth: <float>,
	 *  linecap: "round",
	 *  linejoin: "round"
	 * }
	 */

	function LineBasicMaterial( parameters ) {

		Material.call( this );

		this.type = 'LineBasicMaterial';

		this.color = new Color( 0xffffff );

		this.linewidth = 1;
		this.linecap = 'round';
		this.linejoin = 'round';

		this.lights = false;

		this.setValues( parameters );

	}

	LineBasicMaterial.prototype = Object.create( Material.prototype );
	LineBasicMaterial.prototype.constructor = LineBasicMaterial;

	LineBasicMaterial.prototype.isLineBasicMaterial = true;

	LineBasicMaterial.prototype.copy = function ( source ) {

		Material.prototype.copy.call( this, source );

		this.color.copy( source.color );

		this.linewidth = source.linewidth;
		this.linecap = source.linecap;
		this.linejoin = source.linejoin;

		return this;

	};

	/**
	 * @author alteredq / http://alteredqualia.com/
	 *
	 * parameters = {
	 *  color: <hex>,
	 *  opacity: <float>,
	 *
	 *  linewidth: <float>,
	 *
	 *  scale: <float>,
	 *  dashSize: <float>,
	 *  gapSize: <float>
	 * }
	 */

	function LineDashedMaterial( parameters ) {

		LineBasicMaterial.call( this );

		this.type = 'LineDashedMaterial';

		this.scale = 1;
		this.dashSize = 3;
		this.gapSize = 1;

		this.setValues( parameters );

	}

	LineDashedMaterial.prototype = Object.create( LineBasicMaterial.prototype );
	LineDashedMaterial.prototype.constructor = LineDashedMaterial;

	LineDashedMaterial.prototype.isLineDashedMaterial = true;

	LineDashedMaterial.prototype.copy = function ( source ) {

		LineBasicMaterial.prototype.copy.call( this, source );

		this.scale = source.scale;
		this.dashSize = source.dashSize;
		this.gapSize = source.gapSize;

		return this;

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var RawNode = function( value ) {

		GLNode.call( this, 'v4' );

		this.value = value;

	};

	RawNode.prototype = Object.create( GLNode.prototype );
	RawNode.prototype.constructor = RawNode;

	GLNode.prototype.generate = function( builder ) {

		var data = this.value.parseAndBuildCode( builder, this.type );

		var code = data.code + '\n';

		if ( builder.shader == 'vertex' ) {

			code += 'gl_Position = ' + data.result + ';';

		} else {

			code += 'gl_FragColor = ' + data.result + ';';

		}

		return code;

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var PositionNode = function( scope ) {

		TempNode.call( this, 'v3' );

		this.scope = scope || PositionNode.LOCAL;

	};

	PositionNode.LOCAL = 'local';
	PositionNode.WORLD = 'world';
	PositionNode.VIEW = 'view';
	PositionNode.PROJECTION = 'projection';

	PositionNode.prototype = Object.create( TempNode.prototype );
	PositionNode.prototype.constructor = PositionNode;

	PositionNode.prototype.getType = function( builder ) {

		switch ( this.scope ) {
			case PositionNode.PROJECTION:
				return 'v4';
		}

		return this.type;

	};

	PositionNode.prototype.isShared = function( builder ) {

		switch ( this.scope ) {
			case PositionNode.LOCAL:
			case PositionNode.WORLD:
				return false;
		}

		return true;

	};

	PositionNode.prototype.generate = function( builder, output ) {

		var material = builder.material;
		var result;

		switch ( this.scope ) {

			case PositionNode.LOCAL:

				material.requestAttribs.position = true;

				if ( builder.isShader( 'vertex' ) ) result = 'transformed';
				else result = 'vPosition';

				break;

			case PositionNode.WORLD:

				material.requestAttribs.worldPosition = true;

				if ( builder.isShader( 'vertex' ) ) result = 'vWPosition';
				else result = 'vWPosition';

				break;

			case PositionNode.VIEW:

				if ( builder.isShader( 'vertex' ) ) result = '-mvPosition.xyz';
				else result = 'vViewPosition';

				break;

			case PositionNode.PROJECTION:

				if ( builder.isShader( 'vertex' ) ) result = '(projectionMatrix * modelViewMatrix * vec4( position, 1.0 ))';
				else result = 'vec4( 0.0 )';

				break;

		}

		return builder.format( result, this.getType( builder ), output );

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var NodeBuilder = function( material ) {

		this.material = material;

		this.caches = [];
		this.slots = [];

		this.keywords = {};

		this.parsing = false;
		this.optimize = true;

		this.update();

	};

	NodeBuilder.type = {
		float : 'fv1',
		vec2 : 'v2',
		vec3 : 'v3',
		vec4 : 'v4',
		mat4 : 'v4',
		int : 'iv1'
	};

	NodeBuilder.constructors = [
		'float',
		'vec2',
		'vec3',
		'vec4'
	];

	NodeBuilder.elements = [
		'x',
		'y',
		'z',
		'w'
	];

	NodeBuilder.prototype = {

		constructor: NodeBuilder,

		addCache : function( name, requires ) {

			this.caches.push( {
				name : name || '',
				requires : requires || {}
			} );

			return this.update();

		},

		removeCache : function() {

			this.caches.pop();

			return this.update();

		},

		addSlot : function( name ) {

			this.slots.push( {
				name : name || ''
			} );

			return this.update();

		},

		removeSlot : function() {

			this.slots.pop();

			return this.update();

		},

		isCache : function( name ) {

			var i = this.caches.length;

			while ( i -- ) {

				if ( this.caches[ i ].name == name ) return true;

			}

			return false;

		},

		isSlot : function( name ) {

			var i = this.slots.length;

			while ( i -- ) {

				if ( this.slots[ i ].name == name ) return true;

			}

			return false;

		},

		update : function() {

			var cache = this.caches[ this.caches.length - 1 ];
			var slot = this.slots[ this.slots.length - 1 ];

			this.slot = slot ? slot.name : '';
			this.cache = cache ? cache.name : '';
			this.requires = cache ? cache.requires : {};

			return this;

		},

		require : function( name, node ) {

			this.requires[ name ] = node;

			return this;

		},

		include : function( node, parent, source ) {

			this.material.include( this, node, parent, source );

			return this;

		},

		colorToVector : function( color ) {

			return color.replace( 'r', 'x' ).replace( 'g', 'y' ).replace( 'b', 'z' ).replace( 'a', 'w' );

		},

		getConstructorFromLength : function( len ) {

			return NodeBuilder.constructors[ len - 1 ];

		},

		getFormatName : function( format ) {

			return format.replace( /c/g, 'v3' ).replace( /fv1/g, 'v1' ).replace( /iv1/g, 'i' );

		},

		isFormatMatrix : function( format ) {

			return /^m/.test( format );

		},

		getFormatLength : function( format ) {

			return parseInt( this.getFormatName( format ).substr( 1 ) );

		},

		getFormatFromLength : function( len ) {

			if ( len == 1 ) return 'fv1';

			return 'v' + len;

		},

		format : function( code, from, to ) {

			var format = this.getFormatName( to + '=' + from );

			switch ( format ) {

				case 'v1=v2': return code + '.x';
				case 'v1=v3': return code + '.x';
				case 'v1=v4': return code + '.x';
				case 'v1=i': return 'float(' + code + ')';

				case 'v2=v1': return 'vec2(' + code + ')';
				case 'v2=v3': return code + '.xy';
				case 'v2=v4': return code + '.xy';
				case 'v2=i': return 'vec2(float(' + code + '))';

				case 'v3=v1': return 'vec3(' + code + ')';
				case 'v3=v2': return 'vec3(' + code + ',0.0)';
				case 'v3=v4': return code + '.xyz';
				case 'v3=i': return 'vec2(float(' + code + '))';

				case 'v4=v1': return 'vec4(' + code + ')';
				case 'v4=v2': return 'vec4(' + code + ',0.0,1.0)';
				case 'v4=v3': return 'vec4(' + code + ',1.0)';
				case 'v4=i': return 'vec4(float(' + code + '))';

				case 'i=v1': return 'int(' + code + ')';
				case 'i=v2': return 'int(' + code + '.x)';
				case 'i=v3': return 'int(' + code + '.x)';
				case 'i=v4': return 'int(' + code + '.x)';

			}

			return code;

		},

		getTypeByFormat : function( format ) {

			return NodeBuilder.type[ format ] || format;

		},

		getUuid : function( uuid, useCache ) {

			useCache = useCache !== undefined ? useCache : true;

			if ( useCache && this.cache ) uuid = this.cache + '-' + uuid;

			return uuid;

		},

		getElementByIndex : function( index ) {

			return NodeBuilder.elements[ index ];

		},

		getIndexByElement : function( elm ) {

			return NodeBuilder.elements.indexOf( elm );

		},

		isShader : function( shader ) {

			return this.shader == shader;

		},

		setShader : function( shader ) {

			this.shader = shader;

			return this;

		}
	};

	/**
	 * @author alteredq / http://alteredqualia.com/
	 * @author WestLangley / http://github.com/WestLangley
	 * @author bhouston / http://clara.io
	 * @author tschw
	 */

	function Matrix3() {

		this.elements = [

			1, 0, 0,
			0, 1, 0,
			0, 0, 1

		];

		if ( arguments.length > 0 ) {

			console.error( 'THREE.Matrix3: the constructor no longer reads arguments. use .set() instead.' );

		}

	}

	Object.assign( Matrix3.prototype, {

		isMatrix3: true,

		set: function ( n11, n12, n13, n21, n22, n23, n31, n32, n33 ) {

			var te = this.elements;

			te[ 0 ] = n11; te[ 1 ] = n21; te[ 2 ] = n31;
			te[ 3 ] = n12; te[ 4 ] = n22; te[ 5 ] = n32;
			te[ 6 ] = n13; te[ 7 ] = n23; te[ 8 ] = n33;

			return this;

		},

		identity: function () {

			this.set(

				1, 0, 0,
				0, 1, 0,
				0, 0, 1

			);

			return this;

		},

		clone: function () {

			return new this.constructor().fromArray( this.elements );

		},

		copy: function ( m ) {

			var te = this.elements;
			var me = m.elements;

			te[ 0 ] = me[ 0 ]; te[ 1 ] = me[ 1 ]; te[ 2 ] = me[ 2 ];
			te[ 3 ] = me[ 3 ]; te[ 4 ] = me[ 4 ]; te[ 5 ] = me[ 5 ];
			te[ 6 ] = me[ 6 ]; te[ 7 ] = me[ 7 ]; te[ 8 ] = me[ 8 ];

			return this;

		},

		setFromMatrix4: function ( m ) {

			var me = m.elements;

			this.set(

				me[ 0 ], me[ 4 ], me[ 8 ],
				me[ 1 ], me[ 5 ], me[ 9 ],
				me[ 2 ], me[ 6 ], me[ 10 ]

			);

			return this;

		},

		applyToBufferAttribute: function () {

			var v1 = new Vector3();

			return function applyToBufferAttribute( attribute ) {

				for ( var i = 0, l = attribute.count; i < l; i ++ ) {

					v1.x = attribute.getX( i );
					v1.y = attribute.getY( i );
					v1.z = attribute.getZ( i );

					v1.applyMatrix3( this );

					attribute.setXYZ( i, v1.x, v1.y, v1.z );

				}

				return attribute;

			};

		}(),

		multiply: function ( m ) {

			return this.multiplyMatrices( this, m );

		},

		premultiply: function ( m ) {

			return this.multiplyMatrices( m, this );

		},

		multiplyMatrices: function ( a, b ) {

			var ae = a.elements;
			var be = b.elements;
			var te = this.elements;

			var a11 = ae[ 0 ], a12 = ae[ 3 ], a13 = ae[ 6 ];
			var a21 = ae[ 1 ], a22 = ae[ 4 ], a23 = ae[ 7 ];
			var a31 = ae[ 2 ], a32 = ae[ 5 ], a33 = ae[ 8 ];

			var b11 = be[ 0 ], b12 = be[ 3 ], b13 = be[ 6 ];
			var b21 = be[ 1 ], b22 = be[ 4 ], b23 = be[ 7 ];
			var b31 = be[ 2 ], b32 = be[ 5 ], b33 = be[ 8 ];

			te[ 0 ] = a11 * b11 + a12 * b21 + a13 * b31;
			te[ 3 ] = a11 * b12 + a12 * b22 + a13 * b32;
			te[ 6 ] = a11 * b13 + a12 * b23 + a13 * b33;

			te[ 1 ] = a21 * b11 + a22 * b21 + a23 * b31;
			te[ 4 ] = a21 * b12 + a22 * b22 + a23 * b32;
			te[ 7 ] = a21 * b13 + a22 * b23 + a23 * b33;

			te[ 2 ] = a31 * b11 + a32 * b21 + a33 * b31;
			te[ 5 ] = a31 * b12 + a32 * b22 + a33 * b32;
			te[ 8 ] = a31 * b13 + a32 * b23 + a33 * b33;

			return this;

		},

		multiplyScalar: function ( s ) {

			var te = this.elements;

			te[ 0 ] *= s; te[ 3 ] *= s; te[ 6 ] *= s;
			te[ 1 ] *= s; te[ 4 ] *= s; te[ 7 ] *= s;
			te[ 2 ] *= s; te[ 5 ] *= s; te[ 8 ] *= s;

			return this;

		},

		determinant: function () {

			var te = this.elements;

			var a = te[ 0 ], b = te[ 1 ], c = te[ 2 ],
				d = te[ 3 ], e = te[ 4 ], f = te[ 5 ],
				g = te[ 6 ], h = te[ 7 ], i = te[ 8 ];

			return a * e * i - a * f * h - b * d * i + b * f * g + c * d * h - c * e * g;

		},

		getInverse: function ( matrix, throwOnDegenerate ) {

			if ( matrix && matrix.isMatrix4 ) {

				console.error( "THREE.Matrix3: .getInverse() no longer takes a Matrix4 argument." );

			}

			var me = matrix.elements,
				te = this.elements,

				n11 = me[ 0 ], n21 = me[ 1 ], n31 = me[ 2 ],
				n12 = me[ 3 ], n22 = me[ 4 ], n32 = me[ 5 ],
				n13 = me[ 6 ], n23 = me[ 7 ], n33 = me[ 8 ],

				t11 = n33 * n22 - n32 * n23,
				t12 = n32 * n13 - n33 * n12,
				t13 = n23 * n12 - n22 * n13,

				det = n11 * t11 + n21 * t12 + n31 * t13;

			if ( det === 0 ) {

				var msg = "THREE.Matrix3: .getInverse() can't invert matrix, determinant is 0";

				if ( throwOnDegenerate === true ) {

					throw new Error( msg );

				} else {

					console.warn( msg );

				}

				return this.identity();

			}

			var detInv = 1 / det;

			te[ 0 ] = t11 * detInv;
			te[ 1 ] = ( n31 * n23 - n33 * n21 ) * detInv;
			te[ 2 ] = ( n32 * n21 - n31 * n22 ) * detInv;

			te[ 3 ] = t12 * detInv;
			te[ 4 ] = ( n33 * n11 - n31 * n13 ) * detInv;
			te[ 5 ] = ( n31 * n12 - n32 * n11 ) * detInv;

			te[ 6 ] = t13 * detInv;
			te[ 7 ] = ( n21 * n13 - n23 * n11 ) * detInv;
			te[ 8 ] = ( n22 * n11 - n21 * n12 ) * detInv;

			return this;

		},

		transpose: function () {

			var tmp, m = this.elements;

			tmp = m[ 1 ]; m[ 1 ] = m[ 3 ]; m[ 3 ] = tmp;
			tmp = m[ 2 ]; m[ 2 ] = m[ 6 ]; m[ 6 ] = tmp;
			tmp = m[ 5 ]; m[ 5 ] = m[ 7 ]; m[ 7 ] = tmp;

			return this;

		},

		getNormalMatrix: function ( matrix4 ) {

			return this.setFromMatrix4( matrix4 ).getInverse( this ).transpose();

		},

		transposeIntoArray: function ( r ) {

			var m = this.elements;

			r[ 0 ] = m[ 0 ];
			r[ 1 ] = m[ 3 ];
			r[ 2 ] = m[ 6 ];
			r[ 3 ] = m[ 1 ];
			r[ 4 ] = m[ 4 ];
			r[ 5 ] = m[ 7 ];
			r[ 6 ] = m[ 2 ];
			r[ 7 ] = m[ 5 ];
			r[ 8 ] = m[ 8 ];

			return this;

		},

		setUvTransform: function ( tx, ty, sx, sy, rotation, cx, cy ) {

			var c = Math.cos( rotation );
			var s = Math.sin( rotation );

			this.set(
				sx * c, sx * s, - sx * ( c * cx + s * cy ) + cx + tx,
				- sy * s, sy * c, - sy * ( - s * cx + c * cy ) + cy + ty,
				0, 0, 1
			);

		},

		scale: function ( sx, sy ) {

			var te = this.elements;

			te[ 0 ] *= sx; te[ 3 ] *= sx; te[ 6 ] *= sx;
			te[ 1 ] *= sy; te[ 4 ] *= sy; te[ 7 ] *= sy;

			return this;

		},

		rotate: function ( theta ) {

			var c = Math.cos( theta );
			var s = Math.sin( theta );

			var te = this.elements;

			var a11 = te[ 0 ], a12 = te[ 3 ], a13 = te[ 6 ];
			var a21 = te[ 1 ], a22 = te[ 4 ], a23 = te[ 7 ];

			te[ 0 ] = c * a11 + s * a21;
			te[ 3 ] = c * a12 + s * a22;
			te[ 6 ] = c * a13 + s * a23;

			te[ 1 ] = - s * a11 + c * a21;
			te[ 4 ] = - s * a12 + c * a22;
			te[ 7 ] = - s * a13 + c * a23;

			return this;

		},

		translate: function ( tx, ty ) {

			var te = this.elements;

			te[ 0 ] += tx * te[ 2 ]; te[ 3 ] += tx * te[ 5 ]; te[ 6 ] += tx * te[ 8 ];
			te[ 1 ] += ty * te[ 2 ]; te[ 4 ] += ty * te[ 5 ]; te[ 7 ] += ty * te[ 8 ];

			return this;

		},

		equals: function ( matrix ) {

			var te = this.elements;
			var me = matrix.elements;

			for ( var i = 0; i < 9; i ++ ) {

				if ( te[ i ] !== me[ i ] ) return false;

			}

			return true;

		},

		fromArray: function ( array, offset ) {

			if ( offset === undefined ) offset = 0;

			for ( var i = 0; i < 9; i ++ ) {

				this.elements[ i ] = array[ i + offset ];

			}

			return this;

		},

		toArray: function ( array, offset ) {

			if ( array === undefined ) array = [];
			if ( offset === undefined ) offset = 0;

			var te = this.elements;

			array[ offset ] = te[ 0 ];
			array[ offset + 1 ] = te[ 1 ];
			array[ offset + 2 ] = te[ 2 ];

			array[ offset + 3 ] = te[ 3 ];
			array[ offset + 4 ] = te[ 4 ];
			array[ offset + 5 ] = te[ 5 ];

			array[ offset + 6 ] = te[ 6 ];
			array[ offset + 7 ] = te[ 7 ];
			array[ offset + 8 ] = te[ 8 ];

			return array;

		}

	} );

	/**
	 * @author mrdoob / http://mrdoob.com/
	 * @author alteredq / http://alteredqualia.com/
	 * @author szimek / https://github.com/szimek/
	 */

	var textureId = 0;

	function Texture( image, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding ) {

		Object.defineProperty( this, 'id', { value: textureId ++ } );

		this.uuid = _Math.generateUUID();

		this.name = '';

		this.image = image !== undefined ? image : Texture.DEFAULT_IMAGE;
		this.mipmaps = [];

		this.mapping = mapping !== undefined ? mapping : Texture.DEFAULT_MAPPING;

		this.wrapS = wrapS !== undefined ? wrapS : ClampToEdgeWrapping;
		this.wrapT = wrapT !== undefined ? wrapT : ClampToEdgeWrapping;

		this.magFilter = magFilter !== undefined ? magFilter : LinearFilter;
		this.minFilter = minFilter !== undefined ? minFilter : LinearMipMapLinearFilter;

		this.anisotropy = anisotropy !== undefined ? anisotropy : 1;

		this.format = format !== undefined ? format : RGBAFormat;
		this.type = type !== undefined ? type : UnsignedByteType;

		this.offset = new Vector2( 0, 0 );
		this.repeat = new Vector2( 1, 1 );
		this.center = new Vector2( 0, 0 );
		this.rotation = 0;

		this.matrixAutoUpdate = true;
		this.matrix = new Matrix3();

		this.generateMipmaps = true;
		this.premultiplyAlpha = false;
		this.flipY = true;
		this.unpackAlignment = 4;	// valid values: 1, 2, 4, 8 (see http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml)

		// Values of encoding !== THREE.LinearEncoding only supported on map, envMap and emissiveMap.
		//
		// Also changing the encoding after already used by a Material will not automatically make the Material
		// update.  You need to explicitly call Material.needsUpdate to trigger it to recompile.
		this.encoding = encoding !== undefined ? encoding : LinearEncoding;

		this.version = 0;
		this.onUpdate = null;

	}

	Texture.DEFAULT_IMAGE = undefined;
	Texture.DEFAULT_MAPPING = UVMapping;

	Object.defineProperty( Texture.prototype, "needsUpdate", {

		set: function ( value ) {

			if ( value === true ) this.version ++;

		}

	} );

	Object.assign( Texture.prototype, EventDispatcher.prototype, {

		constructor: Texture,

		isTexture: true,

		clone: function () {

			return new this.constructor().copy( this );

		},

		copy: function ( source ) {

			this.name = source.name;

			this.image = source.image;
			this.mipmaps = source.mipmaps.slice( 0 );

			this.mapping = source.mapping;

			this.wrapS = source.wrapS;
			this.wrapT = source.wrapT;

			this.magFilter = source.magFilter;
			this.minFilter = source.minFilter;

			this.anisotropy = source.anisotropy;

			this.format = source.format;
			this.type = source.type;

			this.offset.copy( source.offset );
			this.repeat.copy( source.repeat );
			this.center.copy( source.center );
			this.rotation = source.rotation;

			this.matrixAutoUpdate = source.matrixAutoUpdate;
			this.matrix.copy( source.matrix );

			this.generateMipmaps = source.generateMipmaps;
			this.premultiplyAlpha = source.premultiplyAlpha;
			this.flipY = source.flipY;
			this.unpackAlignment = source.unpackAlignment;
			this.encoding = source.encoding;

			return this;

		},

		toJSON: function ( meta ) {

			var isRootObject = ( meta === undefined || typeof meta === 'string' );

			if ( ! isRootObject && meta.textures[ this.uuid ] !== undefined ) {

				return meta.textures[ this.uuid ];

			}

			function getDataURL( image ) {

				var canvas;

				if ( image instanceof HTMLCanvasElement ) {

					canvas = image;

				} else {

					canvas = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'canvas' );
					canvas.width = image.width;
					canvas.height = image.height;

					var context = canvas.getContext( '2d' );

					if ( image instanceof ImageData ) {

						context.putImageData( image, 0, 0 );

					} else {

						context.drawImage( image, 0, 0, image.width, image.height );

					}

				}

				if ( canvas.width > 2048 || canvas.height > 2048 ) {

					return canvas.toDataURL( 'image/jpeg', 0.6 );

				} else {

					return canvas.toDataURL( 'image/png' );

				}

			}

			var output = {
				metadata: {
					version: 4.5,
					type: 'Texture',
					generator: 'Texture.toJSON'
				},

				uuid: this.uuid,
				name: this.name,

				mapping: this.mapping,

				repeat: [ this.repeat.x, this.repeat.y ],
				offset: [ this.offset.x, this.offset.y ],
				center: [ this.center.x, this.center.y ],
				rotation: this.rotation,

				wrap: [ this.wrapS, this.wrapT ],

				minFilter: this.minFilter,
				magFilter: this.magFilter,
				anisotropy: this.anisotropy,

				flipY: this.flipY
			};

			if ( this.image !== undefined ) {

				// TODO: Move to THREE.Image

				var image = this.image;

				if ( image.uuid === undefined ) {

					image.uuid = _Math.generateUUID(); // UGH

				}

				if ( ! isRootObject && meta.images[ image.uuid ] === undefined ) {

					meta.images[ image.uuid ] = {
						uuid: image.uuid,
						url: getDataURL( image )
					};

				}

				output.image = image.uuid;

			}

			if ( ! isRootObject ) {

				meta.textures[ this.uuid ] = output;

			}

			return output;

		},

		dispose: function () {

			this.dispatchEvent( { type: 'dispose' } );

		},

		transformUv: function ( uv ) {

			if ( this.mapping !== UVMapping ) return;

			uv.applyMatrix3( this.matrix );

			if ( uv.x < 0 || uv.x > 1 ) {

				switch ( this.wrapS ) {

					case RepeatWrapping:

						uv.x = uv.x - Math.floor( uv.x );
						break;

					case ClampToEdgeWrapping:

						uv.x = uv.x < 0 ? 0 : 1;
						break;

					case MirroredRepeatWrapping:

						if ( Math.abs( Math.floor( uv.x ) % 2 ) === 1 ) {

							uv.x = Math.ceil( uv.x ) - uv.x;

						} else {

							uv.x = uv.x - Math.floor( uv.x );

						}
						break;

				}

			}

			if ( uv.y < 0 || uv.y > 1 ) {

				switch ( this.wrapT ) {

					case RepeatWrapping:

						uv.y = uv.y - Math.floor( uv.y );
						break;

					case ClampToEdgeWrapping:

						uv.y = uv.y < 0 ? 0 : 1;
						break;

					case MirroredRepeatWrapping:

						if ( Math.abs( Math.floor( uv.y ) % 2 ) === 1 ) {

							uv.y = Math.ceil( uv.y ) - uv.y;

						} else {

							uv.y = uv.y - Math.floor( uv.y );

						}
						break;

				}

			}

			if ( this.flipY ) {

				uv.y = 1 - uv.y;

			}

		}

	} );

	/**
	 * @author mrdoob / http://mrdoob.com/
	 */

	function CubeTexture( images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding ) {

		images = images !== undefined ? images : [];
		mapping = mapping !== undefined ? mapping : CubeReflectionMapping;

		Texture.call( this, images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, encoding );

		this.flipY = false;

	}

	CubeTexture.prototype = Object.create( Texture.prototype );
	CubeTexture.prototype.constructor = CubeTexture;

	CubeTexture.prototype.isCubeTexture = true;

	Object.defineProperty( CubeTexture.prototype, 'images', {

		get: function () {

			return this.image;

		},

		set: function ( value ) {

			this.image = value;

		}

	} );

	/**
	 * @author sunag / http://www.sunag.com.br/
	 * @thanks bhouston / https://clara.io/
	 */

	var FunctionNode = function( src, includesOrType, extensionsOrIncludes, keywordsOrExtensions ) {

		src = src || '';

		this.isMethod = typeof includesOrType !== "string";
		this.useKeywords = true;

		TempNode.call( this, this.isMethod ? null : includesOrType );

		if ( this.isMethod ) this.eval( src, includesOrType, extensionsOrIncludes, keywordsOrExtensions );
		else this.eval( src, extensionsOrIncludes, keywordsOrExtensions );

	};

	FunctionNode.rDeclaration = /^([a-z_0-9]+)\s([a-z_0-9]+)\s?\((.*?)\)/i;
	FunctionNode.rProperties = /[a-z_0-9]+/ig;

	FunctionNode.prototype = Object.create( TempNode.prototype );
	FunctionNode.prototype.constructor = FunctionNode;

	FunctionNode.prototype.isShared = function( builder, output ) {

		return ! this.isMethod;

	};

	FunctionNode.prototype.getType = function( builder ) {

		return builder.getTypeByFormat( this.type );

	};

	FunctionNode.prototype.getInputByName = function( name ) {

		var i = this.inputs.length;

		while ( i -- ) {

			if ( this.inputs[ i ].name === name )
				return this.inputs[ i ];

		}

	};

	FunctionNode.prototype.getIncludeByName = function( name ) {

		var i = this.includes.length;

		while ( i -- ) {

			if ( this.includes[ i ].name === name )
				return this.includes[ i ];

		}

	};

	FunctionNode.prototype.generate = function( builder, output ) {

		var match, offset = 0, src = this.value;

		for ( var i = 0; i < this.includes.length; i ++ ) {

			builder.include( this.includes[ i ], this );

		}

		for ( var ext in this.extensions ) {

			builder.material.extensions[ ext ] = true;

		}

		while ( match = FunctionNode.rProperties.exec( this.value ) ) {

			var prop = match[ 0 ], isGlobal = this.isMethod ? ! this.getInputByName( prop ) : true;
			var reference = prop;

			if ( this.keywords[ prop ] || ( this.useKeywords && isGlobal && NodeLib.containsKeyword( prop ) ) ) {

				var node = this.keywords[ prop ];

				if ( ! node ) {

					var keyword = NodeLib.getKeywordData( prop );

					if ( keyword.cache ) node = builder.keywords[ prop ];

					node = node || NodeLib.getKeyword( prop, builder );

					if ( keyword.cache ) builder.keywords[ prop ] = node;

				}

				reference = node.build( builder );

			}

			if ( prop != reference ) {

				src = src.substring( 0, match.index + offset ) + reference + src.substring( match.index + prop.length + offset );

				offset += reference.length - prop.length;

			}

			if ( this.getIncludeByName( reference ) === undefined && NodeLib.contains( reference ) ) {

				builder.include( NodeLib.get( reference ) );

			}

		}

		if ( output === 'source' ) {

			return src;

		} else if ( this.isMethod ) {

			builder.include( this, false, src );

			return this.name;

		} else {

			return builder.format( "(" + src + ")", this.getType( builder ), output );

		}

	};

	FunctionNode.prototype.eval = function( src, includes, extensions, keywords ) {

		src = ( src || '' ).trim();

		this.includes = includes || [];
		this.extensions = extensions || {};
		this.keywords = keywords || {};

		if ( this.isMethod ) {

			var match = src.match( FunctionNode.rDeclaration );

			this.inputs = [];

			if ( match && match.length == 4 ) {

				this.type = match[ 1 ];
				this.name = match[ 2 ];

				var inputs = match[ 3 ].match( FunctionNode.rProperties );

				if ( inputs ) {

					var i = 0;

					while ( i < inputs.length ) {

						var qualifier = inputs[ i ++ ];
						var type, name;

						if ( qualifier == 'in' || qualifier == 'out' || qualifier == 'inout' ) {

							type = inputs[ i ++ ];

						} else {

							type = qualifier;
							qualifier = '';

						}

						name = inputs[ i ++ ];

						this.inputs.push( {
							name : name,
							type : type,
							qualifier : qualifier
						} );

					}

				}

			} else {

				this.type = '';
				this.name = '';

			}

		}

		this.value = src;

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var ConstNode = function( src, useDefine ) {

		TempNode.call( this );

		this.eval( src || ConstNode.PI, useDefine );

	};

	ConstNode.PI = 'PI';
	ConstNode.PI2 = 'PI2';
	ConstNode.RECIPROCAL_PI = 'RECIPROCAL_PI';
	ConstNode.RECIPROCAL_PI2 = 'RECIPROCAL_PI2';
	ConstNode.LOG2 = 'LOG2';
	ConstNode.EPSILON = 'EPSILON';

	ConstNode.prototype = Object.create( TempNode.prototype );
	ConstNode.prototype.constructor = ConstNode;

	ConstNode.prototype.getType = function( builder ) {

		return builder.getTypeByFormat( this.type );

	};

	ConstNode.prototype.eval = function( src, useDefine ) {

		src = ( src || '' ).trim();

		var name, type, value;

		var rDeclaration = /^([a-z_0-9]+)\s([a-z_0-9]+)\s?\=?\s?(.*?)(\;|$)/i;
		var match = src.match( rDeclaration );

		this.useDefine = useDefine;

		if ( match && match.length > 1 ) {

			type = match[ 1 ];
			name = match[ 2 ];
			value = match[ 3 ];

		} else {

			name = src;
			type = 'fv1';

		}

		this.name = name;
		this.type = type;
		this.value = value;

	};

	ConstNode.prototype.build = function( builder, output ) {

		if ( output === 'source' ) {

			if ( this.value ) {

				if ( this.useDefine ) {

					return '#define ' + this.name + ' ' + this.value;

				}

				return 'const ' + this.type + ' ' + this.name + ' = ' + this.value + ';';

			}

		} else {

			builder.include( this );

			return builder.format( this.name, this.getType( builder ), output );

		}

	};

	ConstNode.prototype.generate = function( builder, output ) {

		return builder.format( this.name, this.getType( builder ), output );

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var NodeMaterial = function( vertex, fragment ) {

		ShaderMaterial.call( this );

		this.vertex = vertex || new RawNode( new PositionNode( PositionNode.PROJECTION ) );
		this.fragment = fragment || new RawNode( new ColorNode( 0xFF0000 ) );

	};

	NodeMaterial.types = {
		t : 'sampler2D',
		tc : 'samplerCube',
		bv1 : 'bool',
		iv1 : 'int',
		fv1 : 'float',
		c : 'vec3',
		v2 : 'vec2',
		v3 : 'vec3',
		v4 : 'vec4',
		m4 : 'mat4'
	};

	NodeMaterial.addShortcuts = function( proto, prop, list ) {

		function applyShortcut( prop, name ) {

			return {
				get: function() {

					return this[ prop ][ name ];

				},
				set: function( val ) {

					this[ prop ][ name ] = val;

				}
			};

		}

		return ( function() {

			var shortcuts = {};

			for ( var i = 0; i < list.length; ++ i ) {

				var name = list[ i ];

				shortcuts[ name ] = applyShortcut( prop, name );

			}

			Object.defineProperties( proto, shortcuts );

		} )();

	};

	NodeMaterial.prototype = Object.create( ShaderMaterial.prototype );
	NodeMaterial.prototype.constructor = NodeMaterial;

	NodeMaterial.prototype.updateFrame = function( delta ) {

		for ( var i = 0; i < this.requestUpdate.length; ++ i ) {

			this.requestUpdate[ i ].updateFrame( delta );

		}

	};

	NodeMaterial.prototype.build = function() {

		var vertex, fragment;

		this.defines = {};
		this.uniforms = {};
		this.attributes = {};

		this.extensions = {};

		this.nodeData = {};	

		this.vertexUniform = [];
		this.fragmentUniform = [];

		this.vars = [];
		this.vertexTemps = [];
		this.fragmentTemps = [];

		this.uniformList = [];

		this.consts = [];
		this.functions = [];

		this.requestUpdate = [];

		this.requestAttribs = {
			uv: [],
			color: []
		};

		this.vertexPars = '';
		this.fragmentPars = '';

		this.vertexCode = '';
		this.fragmentCode = '';

		this.vertexNode = '';
		this.fragmentNode = '';

		this.prefixCode = [
		"#ifdef GL_EXT_shader_texture_lod",

		"	#define texCube(a, b) textureCube(a, b)",
		"	#define texCubeBias(a, b, c) textureCubeLodEXT(a, b, c)",

		"	#define tex2D(a, b) texture2D(a, b)",
		"	#define tex2DBias(a, b, c) texture2DLodEXT(a, b, c)",

		"#else",

		"	#define texCube(a, b) textureCube(a, b)",
		"	#define texCubeBias(a, b, c) textureCube(a, b, c)",

		"	#define tex2D(a, b) texture2D(a, b)",
		"	#define tex2DBias(a, b, c) texture2D(a, b, c)",

		"#endif",

		"#include <packing>"

		].join( "\n" );

		var builder = new NodeBuilder( this );

		vertex = this.vertex.build( builder.setShader( 'vertex' ), 'v4' );
		fragment = this.fragment.build( builder.setShader( 'fragment' ), 'v4' );

		if ( this.requestAttribs.uv[ 0 ] ) {

			this.addVertexPars( 'varying vec2 vUv;' );
			this.addFragmentPars( 'varying vec2 vUv;' );

			this.addVertexCode( 'vUv = uv;' );

		}

		if ( this.requestAttribs.uv[ 1 ] ) {

			this.addVertexPars( 'varying vec2 vUv2; attribute vec2 uv2;' );
			this.addFragmentPars( 'varying vec2 vUv2;' );

			this.addVertexCode( 'vUv2 = uv2;' );

		}

		if ( this.requestAttribs.color[ 0 ] ) {

			this.addVertexPars( 'varying vec4 vColor; attribute vec4 color;' );
			this.addFragmentPars( 'varying vec4 vColor;' );

			this.addVertexCode( 'vColor = color;' );

		}

		if ( this.requestAttribs.color[ 1 ] ) {

			this.addVertexPars( 'varying vec4 vColor2; attribute vec4 color2;' );
			this.addFragmentPars( 'varying vec4 vColor2;' );

			this.addVertexCode( 'vColor2 = color2;' );

		}

		if ( this.requestAttribs.position ) {

			this.addVertexPars( 'varying vec3 vPosition;' );
			this.addFragmentPars( 'varying vec3 vPosition;' );

			this.addVertexCode( 'vPosition = transformed;' );

		}

		if ( this.requestAttribs.worldPosition ) {

			// for future update replace from the native "varying vec3 vWorldPosition" for optimization

			this.addVertexPars( 'varying vec3 vWPosition;' );
			this.addFragmentPars( 'varying vec3 vWPosition;' );

			this.addVertexCode( 'vWPosition = worldPosition.xyz;' );

		}

		if ( this.requestAttribs.normal ) {

			this.addVertexPars( 'varying vec3 vObjectNormal;' );
			this.addFragmentPars( 'varying vec3 vObjectNormal;' );

			this.addVertexCode( 'vObjectNormal = normal;' );

		}

		if ( this.requestAttribs.worldNormal ) {

			this.addVertexPars( 'varying vec3 vWNormal;' );
			this.addFragmentPars( 'varying vec3 vWNormal;' );

			this.addVertexCode( 'vWNormal = ( modelMatrix * vec4( objectNormal, 0.0 ) ).xyz;' );

		}

		this.lights = this.requestAttribs.light;
		this.transparent = this.requestAttribs.transparent || this.blending > NormalBlending;

		this.vertexShader = [
			this.prefixCode,
			this.vertexPars,
			this.getCodePars( this.vertexUniform, 'uniform' ),
			this.getIncludes( this.consts[ 'vertex' ] ),
			this.getIncludes( this.functions[ 'vertex' ] ),
			'void main(){',
			this.getCodePars( this.vertexTemps ),
			vertex,
			this.vertexCode,
			'}'
		].join( "\n" );

		this.fragmentShader = [
			this.prefixCode,
			this.fragmentPars,
			this.getCodePars( this.fragmentUniform, 'uniform' ),
			this.getIncludes( this.consts[ 'fragment' ] ),
			this.getIncludes( this.functions[ 'fragment' ] ),
			'void main(){',
			this.getCodePars( this.fragmentTemps ),
			this.fragmentCode,
			fragment,
			'}'
		].join( "\n" );

		this.needsUpdate = true;
		this.dispose(); // force update

		return this;

	};

	NodeMaterial.prototype.define = function( name, value ) {

		this.defines[ name ] = value == undefined ? 1 : value;

	};

	NodeMaterial.prototype.isDefined = function( name ) {

		return this.defines[ name ] != undefined;

	};

	NodeMaterial.prototype.mergeUniform = function( uniforms ) {

		for ( var name in uniforms ) {

			this.uniforms[ name ] = uniforms[ name ];

		}

	};

	NodeMaterial.prototype.createUniform = function( type, value, ns, needsUpdate ) {

		var index = this.uniformList.length;

		var uniform = {
			type : type,
			value : value,
			name : ns ? ns : 'nVu' + index,
			needsUpdate : needsUpdate
		};

		this.uniformList.push( uniform );

		return uniform;

	};

	NodeMaterial.prototype.getVertexTemp = function( uuid, type, ns ) {

		var data = this.vertexTemps[ uuid ];

		if ( ! data ) {

			var index = this.vertexTemps.length,
				name = ns ? ns : 'nVt' + index;

			data = { name : name, type : type };

			this.vertexTemps.push( data );
			this.vertexTemps[ uuid ] = data;

		}

		return data;

	};

	NodeMaterial.prototype.getFragmentTemp = function( uuid, type, ns ) {

		var data = this.fragmentTemps[ uuid ];

		if ( ! data ) {

			var index = this.fragmentTemps.length,
				name = ns ? ns : 'nVt' + index;

			data = { name : name, type : type };

			this.fragmentTemps.push( data );
			this.fragmentTemps[ uuid ] = data;

		}

		return data;

	};

	NodeMaterial.prototype.getVar = function( uuid, type, ns ) {

		var data = this.vars[ uuid ];

		if ( ! data ) {

			var index = this.vars.length,
				name = ns ? ns : 'nVv' + index;

			data = { name : name, type : type };

			this.vars.push( data );
			this.vars[ uuid ] = data;

			this.addVertexPars( 'varying ' + type + ' ' + name + ';' );
			this.addFragmentPars( 'varying ' + type + ' ' + name + ';' );

		}

		return data;

	};

	NodeMaterial.prototype.getAttribute = function( name, type ) {

		if ( ! this.attributes[ name ] ) {

			var varying = this.getVar( name, type );

			this.addVertexPars( 'attribute ' + type + ' ' + name + ';' );
			this.addVertexCode( varying.name + ' = ' + name + ';' );

			this.attributes[ name ] = { varying : varying, name : name, type : type };

		}

		return this.attributes[ name ];

	};

	NodeMaterial.prototype.getIncludes = function() {

		function sortByPosition( a, b ) {

			return a.deps.length - b.deps.length;

		}

		return function( incs ) {

			if ( ! incs ) return '';

			var code = '', incs = incs.sort( sortByPosition );

			for ( var i = 0; i < incs.length; i ++ ) {

				if ( incs[ i ].src ) code += incs[ i ].src + '\n';

			}

			return code;

		}

	}();

	NodeMaterial.prototype.addVertexPars = function( code ) {

		this.vertexPars += code + '\n';

	};

	NodeMaterial.prototype.addFragmentPars = function( code ) {

		this.fragmentPars += code + '\n';

	};

	NodeMaterial.prototype.addVertexCode = function( code ) {

		this.vertexCode += code + '\n';

	};

	NodeMaterial.prototype.addFragmentCode = function( code ) {

		this.fragmentCode += code + '\n';

	};

	NodeMaterial.prototype.addVertexNode = function( code ) {

		this.vertexNode += code + '\n';

	};

	NodeMaterial.prototype.clearVertexNode = function() {

		var code = this.vertexNode;

		this.vertexNode = '';

		return code;

	};

	NodeMaterial.prototype.addFragmentNode = function( code ) {

		this.fragmentNode += code + '\n';

	};

	NodeMaterial.prototype.clearFragmentNode = function() {

		var code = this.fragmentNode;

		this.fragmentNode = '';

		return code;

	};

	NodeMaterial.prototype.getCodePars = function( pars, prefix ) {

		prefix = prefix || '';

		var code = '';

		for ( var i = 0, l = pars.length; i < l; ++ i ) {

			var parsType = pars[ i ].type;
			var parsName = pars[ i ].name;
			var parsValue = pars[ i ].value;

			if ( parsType == 't' && parsValue instanceof CubeTexture ) parsType = 'tc';

			var type = NodeMaterial.types[ parsType ];

			if ( type == undefined ) throw new Error( "Node pars " + parsType + " not found." );

			code += prefix + ' ' + type + ' ' + parsName + ';\n';

		}

		return code;

	};

	NodeMaterial.prototype.createVertexUniform = function( type, value, ns, needsUpdate ) {

		var uniform = this.createUniform( type, value, ns, needsUpdate );

		this.vertexUniform.push( uniform );
		this.vertexUniform[ uniform.name ] = uniform;

		this.uniforms[ uniform.name ] = uniform;

		return uniform;

	};

	NodeMaterial.prototype.createFragmentUniform = function( type, value, ns, needsUpdate ) {

		var uniform = this.createUniform( type, value, ns, needsUpdate );

		this.fragmentUniform.push( uniform );
		this.fragmentUniform[ uniform.name ] = uniform;

		this.uniforms[ uniform.name ] = uniform;

		return uniform;

	};

	NodeMaterial.prototype.getDataNode = function( uuid ) {

		return this.nodeData[ uuid ] = this.nodeData[ uuid ] || {};

	};

	NodeMaterial.prototype.include = function( builder, node, parent, source ) {

		var includes;

		node = typeof node === 'string' ? NodeLib.get( node ) : node;

		if ( node instanceof FunctionNode ) {

			includes = this.functions[ builder.shader ] = this.functions[ builder.shader ] || [];

		} else if ( node instanceof ConstNode ) {

			includes = this.consts[ builder.shader ] = this.consts[ builder.shader ] || [];

		}

		var included = includes[ node.name ];

		if ( ! included ) {

			included = includes[ node.name ] = {
				node : node,
				deps : []
			};

			includes.push( included );

			included.src = node.build( builder, 'source' );

		}

		if ( node instanceof FunctionNode && parent && includes[ parent.name ] && includes[ parent.name ].deps.indexOf( node ) == - 1 ) {

			includes[ parent.name ].deps.push( node );

			if ( node.includes && node.includes.length ) {

				var i = 0;

				do {

					this.include( builder, node.includes[ i ++ ], parent );

				} while ( i < node.includes.length );

			}

		}

		if ( source ) {

			included.src = source;

		}

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var ColorNode = function( color ) {

		InputNode.call( this, 'c' );

		this.value = new Color( color || 0 );

	};

	ColorNode.prototype = Object.create( InputNode.prototype );
	ColorNode.prototype.constructor = ColorNode;

	NodeMaterial.addShortcuts( ColorNode.prototype, 'value', [ 'r', 'g', 'b' ] );

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var FloatNode = function( value ) {

		InputNode.call( this, 'fv1' );

		this.value = [ value || 0 ];

	};

	FloatNode.prototype = Object.create( InputNode.prototype );
	FloatNode.prototype.constructor = FloatNode;

	Object.defineProperties( FloatNode.prototype, {
		number: {
			get: function() {

				return this.value[ 0 ];

			},
			set: function( val ) {

				this.value[ 0 ] = val;

			}
		}
	} );

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var UVNode = function( index ) {

		TempNode.call( this, 'v2', { shared: false } );

		this.index = index || 0;

	};

	UVNode.vertexDict = [ 'uv', 'uv2' ];
	UVNode.fragmentDict = [ 'vUv', 'vUv2' ];

	UVNode.prototype = Object.create( TempNode.prototype );
	UVNode.prototype.constructor = UVNode;

	UVNode.prototype.generate = function( builder, output ) {

		var material = builder.material;
		var result;

		material.requestAttribs.uv[ this.index ] = true;

		if ( builder.isShader( 'vertex' ) ) result = UVNode.vertexDict[ this.index ];
		else result = UVNode.fragmentDict[ this.index ];

		return builder.format( result, this.getType( builder ), output );

	};

	/**
	 * @author sunag / http://www.sunag.com.br/
	 */

	var PhongNode = function () {

		GLNode.call( this );

		this.color = new ColorNode( 0xEEEEEE );
		this.specular = new ColorNode( 0x111111 );
		this.shininess = new FloatNode( 30 );

	};

	PhongNode.prototype = Object.create( GLNode.prototype );
	PhongNode.prototype.constructor = PhongNode;

	PhongNode.prototype.build = function ( builder ) {

		var material = builder.material;
		var code;

		material.define( 'PHONG' );
		material.define( 'ALPHATEST', '0.0' );

		material.requestAttribs.light = true;

		if ( builder.isShader( 'vertex' ) ) {

			var transform = this.transform ? this.transform.parseAndBuildCode( builder, 'v3', { cache: 'transform' } ) : undefined;

			material.mergeUniform( UniformsUtils.merge( [

				UniformsLib[ "fog" ],
				UniformsLib[ "lights" ]

			] ) );

			material.addVertexPars( [
				"varying vec3 vViewPosition;",

				"#ifndef FLAT_SHADED",

				"	varying vec3 vNormal;",

				"#endif",

				"#include <common>",
				"#include <fog_pars_vertex>",
				"#include <morphtarget_pars_vertex>",
				"#include <skinning_pars_vertex>",
				"#include <shadowmap_pars_vertex>",
				"#include <logdepthbuf_pars_vertex>"
			].join( "\n" ) );

			var output = [
				"#include <beginnormal_vertex>",
				"#include <morphnormal_vertex>",
				"#include <skinbase_vertex>",
				"#include <skinnormal_vertex>",
				"#include <defaultnormal_vertex>",

				"#ifndef FLAT_SHADED", // Normal computed with derivatives when FLAT_SHADED

				"	vNormal = normalize( transformedNormal );",

				"#endif",

				"#include <begin_vertex>"
			];

			if ( transform ) {

				output.push(
					transform.code,
					"transformed = " + transform.result + ";"
				);

			}

			output.push(
				"	#include <morphtarget_vertex>",
				"	#include <skinning_vertex>",
				"	#include <project_vertex>",
				"	#include <fog_vertex>",
				"	#include <logdepthbuf_vertex>",

				"	vViewPosition = - mvPosition.xyz;",

				"	#include <worldpos_vertex>",
				"	#include <shadowmap_vertex>"
			);

			code = output.join( "\n" );

		} else {

			// parse all nodes to reuse generate codes

			this.color.parse( builder, { slot: 'color' } );
			this.specular.parse( builder );
			this.shininess.parse( builder );

			if ( this.alpha ) this.alpha.parse( builder );

			if ( this.normal ) this.normal.parse( builder );
			if ( this.normalScale && this.normal ) this.normalScale.parse( builder );

			if ( this.light ) this.light.parse( builder, { cache: 'light' } );

			if ( this.ao ) this.ao.parse( builder );
			if ( this.ambient ) this.ambient.parse( builder );
			if ( this.shadow ) this.shadow.parse( builder );
			if ( this.emissive ) this.emissive.parse( builder, { slot: 'emissive' } );

			if ( this.environment ) this.environment.parse( builder, { slot: 'environment' } );
			if ( this.environmentAlpha && this.environment ) this.environmentAlpha.parse( builder );

			// build code

			var color = this.color.buildCode( builder, 'c', { slot: 'color' } );
			var specular = this.specular.buildCode( builder, 'c' );
			var shininess = this.shininess.buildCode( builder, 'fv1' );

			var alpha = this.alpha ? this.alpha.buildCode( builder, 'fv1' ) : undefined;

			var normal = this.normal ? this.normal.buildCode( builder, 'v3' ) : undefined;
			var normalScale = this.normalScale && this.normal ? this.normalScale.buildCode( builder, 'v2' ) : undefined;

			var light = this.light ? this.light.buildCode( builder, 'v3', { cache: 'light' } ) : undefined;

			var ao = this.ao ? this.ao.buildCode( builder, 'fv1' ) : undefined;
			var ambient = this.ambient ? this.ambient.buildCode( builder, 'c' ) : undefined;
			var shadow = this.shadow ? this.shadow.buildCode( builder, 'c' ) : undefined;
			var emissive = this.emissive ? this.emissive.buildCode( builder, 'c', { slot: 'emissive' } ) : undefined;

			var environment = this.environment ? this.environment.buildCode( builder, 'c', { slot: 'environment' } ) : undefined;
			var environmentAlpha = this.environmentAlpha && this.environment ? this.environmentAlpha.buildCode( builder, 'fv1' ) : undefined;

			material.requestAttribs.transparent = alpha != undefined;

			material.addFragmentPars( [
				"#include <common>",
				"#include <fog_pars_fragment>",
				"#include <bsdfs>",
				"#include <lights_pars>",
				"#include <lights_phong_pars_fragment>",
				"#include <shadowmap_pars_fragment>",
				"#include <logdepthbuf_pars_fragment>"
			].join( "\n" ) );

			var output = [
				// prevent undeclared normal
				"#include <normal_fragment>",

				// prevent undeclared material
				"	BlinnPhongMaterial material;",

				color.code,
				"	vec3 diffuseColor = " + color.result + ";",
				"	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );",

				"#include <logdepthbuf_fragment>",

				specular.code,
				"	vec3 specular = " + specular.result + ";",

				shininess.code,
				"	float shininess = max(0.0001," + shininess.result + ");",

				"	float specularStrength = 1.0;" // Ignored in MaterialNode ( replace to specular )
			];

			if ( alpha ) {

				output.push(
					alpha.code,
					'if ( ' + alpha.result + ' <= ALPHATEST ) discard;'
				);

			}

			if ( normal ) {

				builder.include( 'perturbNormal2Arb' );

				output.push( normal.code );

				if ( normalScale ) output.push( normalScale.code );

				output.push(
					'normal = perturbNormal2Arb(-vViewPosition,normal,' +
					normal.result + ',' +
					new UVNode().build( builder, 'v2' ) + ',' +
					( normalScale ? normalScale.result : 'vec2( 1.0 )' ) + ');'
				);

			}

			// optimization for now

			output.push( 'material.diffuseColor = ' + ( light ? 'vec3( 1.0 )' : 'diffuseColor' ) + ';' );

			output.push(
				// accumulation
				'material.specularColor = specular;',
				'material.specularShininess = shininess;',
				'material.specularStrength = specularStrength;',

				"#include <lights_template>"
			);

			if ( light ) {

				output.push(
					light.code,
					"reflectedLight.directDiffuse = " + light.result + ";"
				);

				// apply color

				output.push(
					"reflectedLight.directDiffuse *= diffuseColor;",
					"reflectedLight.indirectDiffuse *= diffuseColor;"
				);

			}

			if ( ao ) {

				output.push(
					ao.code,
					"reflectedLight.indirectDiffuse *= " + ao.result + ";"
				);

			}

			if ( ambient ) {

				output.push(
					ambient.code,
					"reflectedLight.indirectDiffuse += " + ambient.result + ";"
				);

			}

			if ( shadow ) {

				output.push(
					shadow.code,
					"reflectedLight.directDiffuse *= " + shadow.result + ";",
					"reflectedLight.directSpecular *= " + shadow.result + ";"
				);

			}

			if ( emissive ) {

				output.push(
					emissive.code,
					"reflectedLight.directDiffuse += " + emissive.result + ";"
				);

			}

			output.push( "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular;" );

			if ( environment ) {

				output.push( environment.code );

				if ( environmentAlpha ) {

					output.push(
						environmentAlpha.code,
						"outgoingLight = mix( outgoingLight, " + environment.result + ", " + environmentAlpha.result + " );"
					);

				} else {

					output.push( "outgoingLight = " + environment.result + ";" );

				}

			}

			if ( alpha ) {

				output.push( "gl_FragColor = vec4( outgoingLight, " + alpha.result + " );" );

			} else {

				output.push( "gl_FragColor = vec4( outgoingLight, 1.0 );" );

			}

			output.push(
				"#include <premultiplied_alpha_fragment>",
				"#include <tonemapping_fragment>",
				"#include <encodings_fragment>",
				"#include <fog_fragment>"
			);

			code = output.join( "\n" );

		}

		return code;

	};

	exports.PhongNode = PhongNode;

	return exports;

}({}));