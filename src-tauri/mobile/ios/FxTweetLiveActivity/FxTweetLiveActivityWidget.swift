//
//  FxTweetLiveActivityWidget.swift
//  FxTwitter Archive Studio - by Hikaproj
//  Dynamic Island and Lock Screen Live Activity Widget View (iOS 16+)
//

import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.1, *)
public struct FxTweetLiveActivityWidget: Widget {
    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: FxTweetActivityAttributes.self) { context in
            // Lock Screen Banner View (High Craft, Unslop OLED / Graphite Design)
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Text("fx")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color(white: 0.2))
                            .cornerRadius(4)
                        
                        Text("@\(context.attributes.handle)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.speedText)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(red: 0.15, green: 0.65, blue: 1.0))
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(context.state.statusText)
                                .font(.system(size: 11))
                                .foregroundColor(Color(white: 0.7))
                            Spacer()
                            Text("\(context.state.tweetsCount) posts · \(formatBytes(context.state.totalBytes))")
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color(white: 0.2))
                                    .frame(height: 4)
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color(red: 0.15, green: 0.65, blue: 1.0))
                                    .frame(width: max(0, min(geo.size.width * CGFloat(context.state.progressPct / 100.0), geo.size.width)), height: 4)
                            }
                        }
                        .frame(height: 4)
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                HStack(spacing: 3) {
                    Circle()
                        .fill(context.state.isLocked ? Color.orange : Color.green)
                        .frame(width: 5, height: 5)
                    Text("fx")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                }
            } compactTrailing: {
                Text("\(context.state.tweetsCount)")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(Color(red: 0.15, green: 0.65, blue: 1.0))
            } minimal: {
                Text("fx")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
            }
        }
    }

    private func formatBytes(_ bytes: UInt64) -> String {
        if bytes >= 1024 * 1024 {
            return String(format: "%.1f MB", Double(bytes) / (1024.0 * 1024.0))
        } else if bytes >= 1024 {
            return String(format: "%.1f KB", Double(bytes) / 1024.0)
        } else {
            return "\(bytes) B"
        }
    }
}

@available(iOS 16.1, *)
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<FxTweetActivityAttributes>

    var body: some View {
        VStack(spacing: 8) {
            // Header Bar
            HStack {
                HStack(spacing: 6) {
                    Text("fx")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color(white: 0.2))
                        .cornerRadius(4)
                    Text("FxTwitter Studio")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(white: 0.9))
                    Text("Hikaproj")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color(white: 0.15))
                        .cornerRadius(3)
                        .foregroundColor(Color(white: 0.6))
                }
                Spacer()
                HStack(spacing: 4) {
                    Circle()
                        .fill(context.state.isLocked ? Color.orange : Color.green)
                        .frame(width: 6, height: 6)
                    Text(context.state.isLocked ? "LOCKED" : "ACTIVE")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(context.state.isLocked ? .orange : .green)
                }
            }

            // Target Handle & Metrics Row
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("@\(context.attributes.handle)")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                    Text(context.state.statusText)
                        .font(.system(size: 11))
                        .foregroundColor(Color(white: 0.6))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(context.state.tweetsCount)")
                        .font(.system(size: 18, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                    Text(context.state.speedText)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(Color(red: 0.15, green: 0.65, blue: 1.0))
                }
            }

            // Progress Bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(white: 0.18))
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(red: 0.15, green: 0.65, blue: 1.0))
                        .frame(width: max(0, min(geo.size.width * CGFloat(context.state.progressPct / 100.0), geo.size.width)), height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(14)
        .background(Color(red: 0.07, green: 0.08, blue: 0.10))
    }
}
