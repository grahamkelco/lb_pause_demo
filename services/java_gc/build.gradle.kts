plugins {
    java
    application
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

application {
    mainClass = "com.backpressure.javagc.Main"
    applicationDefaultJvmArgs = listOf(
        "-XX:+UseG1GC",
        "-Xmx512m",
        "-Xms512m",
        "-XX:ParallelGCThreads=1",
        "-XX:ConcGCThreads=1",
        "-XX:MaxGCPauseMillis=200"
    )
}

tasks.jar {
    manifest {
        attributes("Main-Class" to "com.backpressure.javagc.Main")
    }
}
