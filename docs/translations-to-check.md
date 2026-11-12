# Translations to check

These Japanese, Korean and Chinese strings are machine-assisted drafts, not
reviewed by a native speaker. They cover every key whose English changed on
the `claude/ui-review-fixes` branch, and the keys that branch added. They are
already in `frontend/locales/{ja,ko,zh}/index.json`. Please correct them in
place and remove a row from this list once it is checked.

Terms used:

-   "World" (the branch renamed "space" to "world" in visitor copy): ja
    ワールド, ko 월드, zh 世界. No locale had a word for "world" before. If
    zh 世界 reads oddly as a product name, 空间 was the old word.
-   Speaking in a world: ja 発言, ko 발언, zh 发言, as the existing
    `MIC_REQUEST_APPROVED` and `MIC_REQUEST_DENIED` already say.
-   Microphone: ja マイク, ko 마이크, zh 麦克风/麥克風 (unchanged).
-   zh mixes simplified and traditional characters today. The drafts are in
    simplified Chinese; a reviewer may want to settle the whole file on one.

## Keys whose English changed

| Key                                             | English                                                                                   | ja                                                                                             | ko                                                                                      | zh                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `LOW_QUALITY_DESCRIPTION`                       | Best framerate, in case your device is slow in certain worlds.                            | 一部のワールドで端末の動作が遅い場合に、フレームレートを優先します                             | 최상의 프레임 속도. 일부 월드에서 기기가 느린 경우에 사용하세요.                        | 最佳帧率，适用于设备在某些世界中运行较慢的情况。                               |
| `AUDIO_SHARE_CHROME_DESCRIPTION_P2`             | Select a Chrome Tab then "Share" to start playing from your device to this world.         | Chrome タブを選択し、[共有] を選択すると、デバイスからこのワールドへの再生が始まります         | Chrome 탭을 선택한 다음 "공유"를 선택하면 기기에서 이 월드로 재생이 시작됩니다.         | 选择一个 Chrome 标签页，然后点击“共享”，即可从您的设备向这个世界播放。         |
| `AUDIO_SHARE_MICROSOFT_EDGE_TAB_DESCRIPTION_P2` | Select a Microsoft Edge Tab then "Share" to start playing from your device to this world. | Microsoft Edge タブを選択し、[共有] を選択すると、デバイスからこのワールドへの再生が始まります | Microsoft Edge 탭을 선택한 다음 "공유"를 선택하면 기기에서 이 월드로 재생이 시작됩니다. | 选择一个 Microsoft Edge 标签页，然后点击“共享”，即可从您的设备向这个世界播放。 |
| `MUTE_USER_MIC`                                 | Mute user microphone                                                                      | ユーザーのマイクをミュート (unchanged)                                                         | 사용자 마이크 음소거 (unchanged)                                                        | 静音用户麦克风 (unchanged)                                                     |
| `NO_VOICE_REQUEST_DESCRIPTION`                  | No requests to speak right now                                                            | 現在、発言のリクエストはありません                                                             | 지금은 발언 요청이 없습니다                                                             | 目前没有发言请求                                                               |
| `WRITE_HERE`                                    | Write here…                                                                               | ここに書いてください…                                                                          | 여기에 입력하세요…                                                                      | 在这里写…                                                                      |
| `REQUEST_AN_ADMIN_FOR_VOICE`                    | Request to speak                                                                          | 発言をリクエスト                                                                               | 발언 요청                                                                               | 申请发言                                                                       |
| `A_VOICE_REQUEST_HAS_BEEN_SENT`                 | Request sent                                                                              | リクエストを送信しました                                                                       | 요청을 보냈습니다                                                                       | 请求已发送                                                                     |
| `MUTED`                                         | Mute (a button: turns the microphone off)                                                 | ミュート (unchanged)                                                                           | 음소거                                                                                  | 静音                                                                           |
| `UNMUTE`                                        | Enable (a button: turns the microphone on)                                                | 有効にする                                                                                     | 켜기                                                                                    | 开启                                                                           |
| `MIC`                                           | microphone                                                                                | マイク (unchanged)                                                                             | 마이크 (unchanged)                                                                      | 麥克風 (unchanged)                                                             |
| `THE_SPACE_CREATOR`                             | the world creator! (after "Leave a word for")                                             | ワールドのクリエイター！                                                                       | 월드 제작자!                                                                            | 世界创建者！                                                                   |
| `TIPS_SHORTCUTS_DESCRIPTION`                    | A list of useful controls to help you navigate and use any oncyber world                  | oncyber のワールドを移動・利用するのに役立つ操作の一覧                                         | oncyber 월드를 둘러보고 이용하는 데 도움이 되는 유용한 조작 목록                        | 帮助您浏览和使用任何 oncyber 世界的实用操作列表                                |
| `SUCCESSFULLY_TELEPORTED_TO_SPACE`              | Opened a portal to the user's world.                                                      | ユーザーのワールドへのポータルを開きました                                                     | 사용자의 월드로 가는 포털을 열었습니다                                                  | 已打开通往该用户世界的传送门                                                   |
| `NO_EXHIBITS`                                   | No worlds                                                                                 | ワールドはありません                                                                           | 월드 없음                                                                               | 没有世界                                                                       |
| `PANEL_EXPLORE_SEARCH`                          | Search for a world by name, author…                                                       | 名前や作成者でワールドを検索…                                                                  | 이름, 작성자로 월드 검색…                                                               | 按名称、作者搜索世界…                                                          |
| `SPACE_DETAILS`                                 | World details                                                                             | ワールドの詳細                                                                                 | 월드 세부정보                                                                           | 世界详情                                                                       |

## Keys the branch added

| Key                        | English                                                 | ja                                                                   | ko                                                           | zh                                         |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `NO_MODERATOR_TO_APPROVE`  | No moderator is here to let you speak. Try again later. | 発言を許可できるモデレーターがいません。後でもう一度お試しください。 | 발언을 허락할 모더레이터가 없습니다. 나중에 다시 시도하세요. | 目前没有主持人可以允许您发言，请稍后再试。 |
| `FAILED_TO_REMOVE_MESSAGE` | Couldn't remove the message. (guestbook)                | メッセージを削除できませんでした                                     | 메시지를 삭제하지 못했습니다.                                | 删除留言失败                               |
| `MIC_REQUEST_EXPIRED`      | Your request expired. Ask again.                        | リクエストの期限が切れました。もう一度リクエストしてください。       | 요청이 만료되었습니다. 다시 요청하세요.                      | 您的请求已过期，请重新申请。               |

## Noticed while drafting, not changed

-   `FAILED_TO_SAVE_SPACE` in ja reads "couldn't economise on space"
    (スペースを節約できませんでした), and ko and zh say the same; the English
    means "couldn't save the world". The key is only in a commented-out line
    today.

## Removed in the next round

The old mobile chat's emote panel was the only code that read these three
keys, and it was deleted with the legacy editor code. They are gone from all
four locale files, so there is nothing to check for them:
`LOGIN_FROM_THE_PAUSE_MENU_TO_SEND_MORE_MESSAGES`,
`CANT_SEND_SAME_MESSAGE_MORE_THAN_FIVE_TIMES`, `YOU_CANT_SPAM_MESSAGES`.

The new messages of that round (the Studio's failures beside their controls,
the world's "no moderator" notice above the dock, the mint page's claim
failures) added no keys: those parts of the app are written in English only
and do not go through the locale files.

## Added 11 November 2026 (profile save failure)

| Key                 | English                                | 日本語 (draft)                                               | 한국어 (draft)                                    | 中文 (draft)             |
| ------------------- | -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- | ------------------------ |
| `PROFILE_NOT_SAVED` | Your profile was not saved. Try again. | プロフィールを保存できませんでした。もう一度お試しください。 | 프로필을 저장하지 못했습니다. 다시 시도해 주세요. | 个人资料未保存。请重试。 |
