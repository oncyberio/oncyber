import { Editor } from "./edit"


type FirstParam<T extends (...args: any) => any> =
    T extends (arg: infer P, ...rest: any) => any ? P : never

type StartsWith<T, P extends string> = T extends `${P}${string}` ? T : never


type HandlerMethodKeys = StartsWith<keyof Editor, "handle">

type HandlerMethods = {
    [M in HandlerMethodKeys]: Editor[M]
}


type HandlerMethodMap = {
    [M in HandlerMethodKeys as FirstParam<Editor[M]>["type"]]: Editor[M]
}

export type EditorActionMap = {
    [M in HandlerMethodKeys as FirstParam<Editor[M]>["type"]]: FirstParam<Editor[M]>
}


export type EditorReturnType = {
    [M in HandlerMethodKeys as FirstParam<Editor[M]>["type"]]: ReturnType<Editor[M]>
}


export type EDITOR_ACTION = FirstParam<HandlerMethods[HandlerMethodKeys]>

export type EDITOR_ACTION_TYPE = EDITOR_ACTION["type"]

export type HandlerReturnType<A extends EDITOR_ACTION> = ReturnType<HandlerMethodMap[A["type"]]>



