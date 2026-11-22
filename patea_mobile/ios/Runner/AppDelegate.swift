import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    // Las compras y los créditos son solo para la versión de la App Store. El
    // recibo de la app se llama `receipt` en la tienda y `sandboxReceipt` en
    // TestFlight y en desarrollo.
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "PateaDistribution") {
      let channel = FlutterMethodChannel(
        name: "patea/distribution",
        binaryMessenger: registrar.messenger()
      )
      channel.setMethodCallHandler { call, result in
        if call.method == "channel" {
          let receipt = Bundle.main.appStoreReceiptURL?.lastPathComponent
          result(receipt == "receipt" ? "appstore" : "other")
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
    }
  }
}
