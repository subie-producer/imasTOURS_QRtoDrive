/**
 * WebアプリのGETリクエストを処理し、HTMLページを表示します。
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('ツアマスQR画像保存')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT); // カメラアクセスにALLOWALLは通常不要
}

/**
 * 指定されたURLから画像を抽出し、Google Driveに保存します。
 * @param {string} url 画像が含まれるページのURL。
 * @return {object} 処理結果 (success: boolean, message: string, count: number, folderName: string|null)
 */
function saveImagesFromUrl(url) {
  const FOLDER_NAME = "TOURM@S_LIVE_PICTURES"; // 保存先フォルダ名
  let savedCount = 0;
  let driveFolder = null;

  // フォルダを取得または作成
  try {
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) {
      driveFolder = folders.next();
    } else {
      driveFolder = DriveApp.createFolder(FOLDER_NAME);
    }
  } catch (e) {
    console.error("Driveフォルダの取得/作成に失敗: " + e);
    return { success: false, message: "Google Driveのフォルダ処理中にエラーが発生しました。", count: 0, folderName: null };
  }

  if (!driveFolder) {
     return { success: false, message: "Google Driveのフォルダが見つかりません。", count: 0, folderName: null };
  }

  // URL形式の簡易チェック
  if (!url || !url.startsWith('http')) {
    return { success: false, message: "無効なURL形式です。", count: 0, folderName: FOLDER_NAME };
  }

  try {
    // ページのHTMLを取得
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const htmlContent = response.getContentText();

    if (responseCode !== 200) {
      console.error(`URLへのアクセス失敗: ${url}, Status: ${responseCode}`);
      return { success: false, message: `指定されたURLへのアクセスに失敗しました (Status: ${responseCode})。`, count: 0, folderName: FOLDER_NAME };
    }

    // imgタグのsrc属性から画像ファイル名 (例: ./0.jpeg) を抽出
    // 想定される形式: <li><img src="./数字.jpeg" ...></li>
    // より汎用的に .jpeg, .jpg, .png, .gif を対象とする正規表現
    const imgTagRegex = /<img\s+[^>]*src="(\.?\/?([^"]+\.(?:jpeg|jpg|png|gif)))"[^>]*>/gi;
    let match;
    const imageUrls = [];
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1); // URLのディレクトリ部分

    while ((match = imgTagRegex.exec(htmlContent)) !== null) {
      let imgSrc = match[1]; // "./0.jpeg" など
      // 相対パスを絶対URLに変換
      if (imgSrc.startsWith('./')) {
        imgSrc = imgSrc.substring(2); // "./" を削除
      } else if (imgSrc.startsWith('/')) {
         // ルート相対パスの場合の処理 (今回は想定しないが一応)
         const urlParts = url.split('/');
         imgSrc = urlParts[0] + '//' + urlParts[2] + imgSrc;
      }
      const absoluteImageUrl = baseUrl + imgSrc;
      if (!imageUrls.includes(absoluteImageUrl)) { // 重複を避ける
          imageUrls.push(absoluteImageUrl);
      }
    }

    if (imageUrls.length === 0) {
      return { success: false, message: "ページ内に保存対象の画像が見つかりませんでした。", count: 0, folderName: FOLDER_NAME };
    }

    // 各画像をDriveに保存
    imageUrls.forEach(imageUrl => {
      try {
        Utilities.sleep(500); // 連続アクセス負荷軽減のための待機 (任意)
        const imageBlob = UrlFetchApp.fetch(imageUrl).getBlob();
        // ファイル名をURLから抽出 (例: 0.jpeg)
        const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
        // ユニークなファイル名にする (例: 20250401_233015_0.jpeg)
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
        const uniqueFileName = `${timestamp}_${fileName}`;

        driveFolder.createFile(imageBlob.setName(uniqueFileName));
        savedCount++;
        console.log(`Saved: ${uniqueFileName} from ${imageUrl}`);
      } catch (e) {
        console.error(`画像取得/保存失敗: ${imageUrl}, Error: ${e}`);
        // エラーがあっても他の画像の処理は続ける
      }
    });

    if (savedCount > 0) {
      return { success: true, message: `${savedCount}枚の画像を '${FOLDER_NAME}' フォルダに保存しました。`, count: savedCount, folderName: FOLDER_NAME };
    } else {
      return { success: false, message: "画像の保存中にエラーが発生しました。", count: 0, folderName: FOLDER_NAME };
    }

  } catch (e) {
    console.error("処理中に予期せぬエラー: " + e);
    return { success: false, message: "処理中に予期せぬエラーが発生しました。", count: 0, folderName: FOLDER_NAME };
  }
}
