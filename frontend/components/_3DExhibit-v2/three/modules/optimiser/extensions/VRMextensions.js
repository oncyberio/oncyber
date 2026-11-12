import { Extension } from '@gltf-transform/core'

export class VRMExtension extends Extension {
    
    extensionName = 'VRM';
    static EXTENSION_NAME = 'VRM';

    read(context) {

        const json = context.jsonDoc.json;

         if( json.extensions[this.extensionName] ) {

            if(  this.document.getRoot().extras == null ) {

                this.document.getRoot().extras = {}
            }

            // remove material toon fucking properties 
            
            delete json.extensions[this.extensionName].materialProperties


              // fix non zero divisors 
            if ( json.extensions[this.extensionName].lookAt ) {

                const lookAt = json.extensions[this.extensionName].lookAt

                lookAt.rangeMapHorizontalInner.inputMaxValue = 0.00001
                lookAt.rangeMapHorizontalOuter.inputMaxValue = 0.00001
                lookAt.rangeMapVerticalDown.inputMaxValue    = 0.00001
                lookAt.rangeMapVerticalUp.inputMaxValue      = 0.00001
            }


            this.document.getRoot().extras[this.extensionName] = json.extensions[this.extensionName];
         }

        return this
    }

    write(context) {

        const json = context.jsonDoc.json;

        console.log( this.document.getRoot() )
        console.log( this.document.getRoot() )
        console.log( this.document.getRoot() )
        console.log( this.document.getRoot().extras )
        console.log( this.document.getRoot().extras )
        console.log( this.document.getRoot().extras )

        if (this.document.getRoot().extras[this.extensionName]) {

            if(  json.extensions == null ) {

                 json.extensions = {}
            }

           json.extensions[this.extensionName] = this.document.getRoot().extras[this.extensionName] ;

           // remove thumbnail
           json.extensions[this.extensionName].meta.texture = null

        }


        return this
    }
}

export class VRMC_Extension extends Extension {
    extensionName = 'VRMC_vrm';
    static EXTENSION_NAME = 'VRMC_vrm';

    read(context) {


        const json = context.jsonDoc.json;

         if( json.extensions[this.extensionName] ) {

            if(  this.document.getRoot().extras == null ) {

                this.document.getRoot().extras = {}
            }

            // remove material toon fucking properties 

            delete json.extensions[this.extensionName].materialProperties

            // fix non zero divisors 
            if ( json.extensions[this.extensionName].lookAt ) {

                const lookAt = json.extensions[this.extensionName].lookAt

                lookAt.rangeMapHorizontalInner.inputMaxValue    = 0.00001
                lookAt.rangeMapHorizontalOuter.inputMaxValue    = 0.00001
                lookAt.rangeMapVerticalDown.inputMaxValue       = 0.00001
                lookAt.rangeMapVerticalUp.inputMaxValue         = 0.00001
            }
          
            this.document.getRoot().extras[this.extensionName] = json.extensions[this.extensionName];
         }

        return this
    }

    write(context) {

        const json = context.jsonDoc.json;

        if (this.document.getRoot().extras[this.extensionName]) {

            if(  json.extensions == null ) {

                 json.extensions = {}
            }

           json.extensions[this.extensionName] = this.document.getRoot().extras[this.extensionName] ;

           // remove thumbnail
           json.extensions[this.extensionName].meta.texture = null

        }

        return this
    }
}


export class VRMC_materials_mtoon extends Extension {
    extensionName = 'VRMC_materials_mtoon';
    static EXTENSION_NAME = 'VRMC_materials_mtoon';

    /** Creates a new Emitter property, for use on a Node. */
    createEmitter(name = '') {
    }

    /** See https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/src/io/reader-context.ts */
    read(context) {

        const json = context.jsonDoc.json;

        return this
        // throw new Error('VRM: read() not implemented');
    }

    /** See https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/src/io/writer-context.ts */
    write(context) {
        return this
        // throw new Error('VRM: write() not implemented');
    }
}


export class VRMC_springBone extends Extension {
    extensionName = 'VRMC_springBone';
    static EXTENSION_NAME = 'VRMC_springBone';

    /** Creates a new Emitter property, for use on a Node. */
    createEmitter(name = '') {
    }

    /** See https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/src/io/reader-context.ts */
    read(context) {

        const json = context.jsonDoc.json;

        

         if( json.extensions[this.extensionName] ) {

            if(  this.document.getRoot().extras == null ) {

                this.document.getRoot().extras = {}
            }
          
            this.document.getRoot().extras[this.extensionName] = json.extensions[this.extensionName];
         }


        return this
        // throw new Error('VRM: read() not implemented');
    }

    /** See https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/src/io/writer-context.ts */
    write(context) {

        const json = context.jsonDoc.json;

        if (this.document.getRoot().extras[this.extensionName]) {

            if(  json.extensions == null ) {

                 json.extensions = {}
            }

           json.extensions[this.extensionName] = this.document.getRoot().extras[this.extensionName] ;

        }

        return this
        // throw new Error('VRM: write() not implemented');
    }
}

export class VRMC_node_constraint extends Extension {

    extensionName = 'VRMC_node_constraint';

    static EXTENSION_NAME = 'VRMC_node_constraint';

    constructor( doc ){

        super( doc )

        this.constraints = new Map()
    }

    /** Creates a new Emitter property, for use on a Node. */
    createEmitter(name = '') {

        // return new Emitter(this.document.getGraph(), name);
    }

    setConstraint(node, data) {

       this.constraints.set(node, data);

       return this;
    }

   // Retrieves constraint data.
    getConstraint(node) {

       return this.constraints.get(node);
    }

   // Removes constraint data.
   removeConstraint(node) {

       this.constraints.delete(node);

       return this;
    }

    /** See https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/src/io/reader-context.ts */
    read(context) {

        const json = context.jsonDoc.json;

        const nodeDefs = json.nodes || [];

        nodeDefs.forEach((nodeDef, nodeIndex) => {

            if (!nodeDef.extensions || !nodeDef.extensions[this.extensionName]) return;

            this.setConstraint(nodeIndex, nodeDef.extensions[this.extensionName] )
            
        });

        return this
    }

    /** See https://github.com/donmccurdy/glTF-Transform/blob/main/packages/core/src/io/writer-context.ts */
    write(context) {

        const json = context.jsonDoc.json;

        const nodeDefs = json.nodes || [];

        nodeDefs.forEach((nodeDef, nodeIndex) => {

            const constraints = this.getConstraint(nodeIndex)

            if( constraints != null ) {

                nodeDef.extensions = nodeDef.extensions || {}

                nodeDef.extensions[this.extensionName] = constraints
            }
        });

        return this
    }
}

