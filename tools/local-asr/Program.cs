using System.Text;
using System.Text.Json;
using Whisper.net;
using Whisper.net.LibraryLoader;
using System.Runtime.Intrinsics.X86;

Console.OutputEncoding = new UTF8Encoding(false);
try
{
    var settings = JsonDocument.Parse(File.ReadAllText(args[0])).RootElement;
    var cpu = args.Contains("--cpu");
    var optimizedCpu = Avx.IsSupported && Avx2.IsSupported && Fma.IsSupported
        && (X86Base.CpuId(1, 0).Ecx & (1 << 29)) != 0;
    var cpuRuntimes = optimizedCpu
        ? new List<RuntimeLibrary> { RuntimeLibrary.Cpu, RuntimeLibrary.CpuNoAvx }
        : new List<RuntimeLibrary> { RuntimeLibrary.CpuNoAvx };
    RuntimeOptions.RuntimeLibraryOrder = cpu
        ? cpuRuntimes
        : new List<RuntimeLibrary> { RuntimeLibrary.Vulkan }.Concat(cpuRuntimes).ToList();
    using var factory = WhisperFactory.FromPath(settings.GetProperty("nativeModel").GetString()!, new WhisperFactoryOptions { UseGpu = !cpu });
    var builder = factory.CreateBuilder()
        .WithThreads(Math.Min(8, Environment.ProcessorCount))
        .WithLanguage(settings.GetProperty("language").GetString() ?? "auto")
        .WithNoContext()
        .WithTokenTimestamps()
        .WithMaxSegmentLength(settings.GetProperty("maxChars").GetInt32());
    if (settings.GetProperty("language").GetString() == "zh") builder.WithPrompt("以下是简体中文对白字幕。");
    using var processor = builder.Build();
    using var audio = File.OpenRead(Path.Combine(settings.GetProperty("directory").GetString()!, "识别音轨.wav"));
    Console.WriteLine(JsonSerializer.Serialize(new { type = "runtime", device = RuntimeOptions.LoadedLibrary.ToString() }));
    await foreach (var segment in processor.ProcessAsync(audio))
    {
        Console.WriteLine(JsonSerializer.Serialize(new { type = "segment", start = segment.Start.TotalSeconds, end = segment.End.TotalSeconds, text = segment.Text, language = segment.Language }));
    }
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine(error.ToString());
    return 1;
}
