const NEWLINE = '\n';

function fgets( buffer, lineLimit, consume ) {

    const chunkSize = 128;

    lineLimit = ! lineLimit ? 1024 : lineLimit;
    let p = buffer.pos,
        i = - 1, len = 0, s = '',
        chunk = String.fromCharCode.apply( null, new Uint16Array( buffer.subarray( p, p + chunkSize ) ) );

    while ( ( 0 > ( i = chunk.indexOf( NEWLINE ) ) ) && ( len < lineLimit ) && ( p < buffer.byteLength ) ) {

        s += chunk; len += chunk.length;
        p += chunkSize;
        chunk += String.fromCharCode.apply( null, new Uint16Array( buffer.subarray( p, p + chunkSize ) ) );

    }

    if ( - 1 < i ) {

        /*for (i=l-1; i>=0; i--) {
            byteCode = m.charCodeAt(i);
            if (byteCode > 0x7f && byteCode <= 0x7ff) byteLen++;
            else if (byteCode > 0x7ff && byteCode <= 0xffff) byteLen += 2;
            if (byteCode >= 0xDC00 && byteCode <= 0xDFFF) i--; //trail surrogate
        }*/
        if ( false !== consume ) buffer.pos += len + i + 1;
        return s + chunk.slice( 0, i );

    }
    return false
}

export default function checkHDRDimensions(buffer) {

    const
        /* return codes for rgbe routines */
        //RGBE_RETURN_SUCCESS = 0,
        RGBE_RETURN_FAILURE = - 1,

        /* default error routine.  change this to change error handling */
        rgbe_read_error = 1,
        rgbe_write_error = 2,
        rgbe_format_error = 3,
        rgbe_memory_error = 4,
        rgbe_error = function ( rgbe_error_code, msg ) {

            switch ( rgbe_error_code ) {

                case rgbe_read_error: console.error( 'THREE.RGBELoader Read Error: ' + ( msg || '' ) );
                    break;
                case rgbe_write_error: console.error( 'THREE.RGBELoader Write Error: ' + ( msg || '' ) );
                    break;
                case rgbe_format_error: console.error( 'THREE.RGBELoader Bad File Format: ' + ( msg || '' ) );
                    break;
                default:
                case rgbe_memory_error: console.error( 'THREE.RGBELoader: Error: ' + ( msg || '' ) );

            }

            return RGBE_RETURN_FAILURE;

        },

        /* offsets to red, green, and blue components in a data (float) pixel */
        //RGBE_DATA_RED = 0,
        //RGBE_DATA_GREEN = 1,
        //RGBE_DATA_BLUE = 2,

        /* number of floats per pixel, use 4 since stored in rgba image format */
        //RGBE_DATA_SIZE = 4,

        /* flags indicating which fields in an rgbe_header_info are valid */
        RGBE_VALID_PROGRAMTYPE = 1,
        RGBE_VALID_FORMAT = 2,
        RGBE_VALID_DIMENSIONS = 4

    // regexes to parse header info fields
    const magic_token_re = /^#\?(\S+)/,
        gamma_re = /^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,
        exposure_re = /^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,
        format_re = /^\s*FORMAT=(\S+)\s*$/,
        dimensions_re = /^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,

        // RGBE format header struct
        header = {

            valid: 0, /* indicate which fields are valid */

            string: '', /* the actual header string */

            comments: '', /* comments found in header */

            programtype: 'RGBE', /* listed at beginning of file to identify it after "#?". defaults to "RGBE" */

            format: '', /* RGBE format, default 32-bit_rle_rgbe */

            gamma: 1.0, /* image has already been gamma corrected with given gamma. defaults to 1.0 (no correction) */

            exposure: 1.0, /* a value of 1.0 in an image corresponds to <exposure> watts/steradian/m^2. defaults to 1.0 */

            width: 0, height: 0 /* image dimensions, width/height */

        };

    let line, match;

    buffer.pos = 0

    if ( buffer.pos >= buffer.byteLength || ! ( line = fgets( buffer ) ) ) {

        return rgbe_error( rgbe_read_error, 'no header found' );

    }

    /* if you want to require the magic token then uncomment the next line */
    if ( ! ( match = line.match( magic_token_re ) ) ) {

        return rgbe_error( rgbe_format_error, 'bad initial token' );

    }

    header.valid |= RGBE_VALID_PROGRAMTYPE;
    header.programtype = match[ 1 ];
    header.string += line + '\n';

    while ( true ) {

        line = fgets( buffer );
        if ( false === line ) break;
        header.string += line + '\n';

        if ( '#' === line.charAt( 0 ) ) {

            header.comments += line + '\n';
            continue; // comment line

        }

        if ( match = line.match( gamma_re ) ) {

            header.gamma = parseFloat( match[ 1 ] );

        }

        if ( match = line.match( exposure_re ) ) {

            header.exposure = parseFloat( match[ 1 ] );

        }

        if ( match = line.match( format_re ) ) {

            header.valid |= RGBE_VALID_FORMAT;
            header.format = match[ 1 ];//'32-bit_rle_rgbe';

        }

        if ( match = line.match( dimensions_re ) ) {

            header.valid |= RGBE_VALID_DIMENSIONS;
            header.height = parseInt( match[ 1 ], 10 );
            header.width = parseInt( match[ 2 ], 10 );

        }

        if ( ( header.valid & RGBE_VALID_FORMAT ) && ( header.valid & RGBE_VALID_DIMENSIONS ) ) break;

    }

    if ( ! ( header.valid & RGBE_VALID_FORMAT ) ) {

        console.log( rgbe_format_error, 'missing format specifier' );

    }

    if ( ! ( header.valid & RGBE_VALID_DIMENSIONS ) ) {

        console.log( rgbe_format_error, 'missing image size specifier' );

    }

    console.log( header )
    console.log( header )
    console.log( header )
    console.log( header )

    return header
}
