


export function getNextAutoIncr(prefix, type, prop, components) {

    let max = 0

    for (let i = 0;  i < components.length; i++) {

        const component = components[i]

        if (component.data.type !== type) continue

        const val = component.data[prop]

        if (val?.startsWith(prefix)) {

            const id = parseInt(val.slice(prefix.length))

            if (id > max) max = id
        }
    }

    return `${prefix} ${max + 1}`
}