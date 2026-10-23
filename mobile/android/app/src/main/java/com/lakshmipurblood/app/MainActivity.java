package com.lakshmipurblood.app;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onPause() {
        super.onPause();
        // Save the sign-in cookie to disk now, so it survives Android closing the app in the background.
        CookieManager.getInstance().flush();
    }
}
